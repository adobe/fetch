/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/* eslint-env mocha */

import assert from 'assert';
import { createHash } from 'crypto';

import sinon from 'sinon';

import Server from '../server.js';
import {
  fetch, context, noCache, reset, onPush, offPush,
} from '../../src/index.js';

const WOKEUP = 'woke up!';
const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms, WOKEUP);
});

const HELLO_WORLD = 'Hello, World!';

describe('HTTP/2-specific Fetch Tests', () => {
  let server;

  before(async () => {
    // start secure HTTP/2 server
    server = new Server(2, true, HELLO_WORLD);
    await server.start();
  });

  after(async () => {
    await server.close();
  });

  afterEach(async () => {
    await reset();
  });

  it('supports self signed certificate', async () => {
    // self signed certificates are rejected by default
    assert.rejects(() => fetch(`${server.origin}/hello`));

    const ctx = context({ rejectUnauthorized: false });
    try {
      let resp = await ctx.fetch(`${server.origin}/hello`, { cache: 'no-store' });
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.httpVersion, '2.0');
      let body = await resp.text();
      assert.strictEqual(body, HELLO_WORLD);

      // try again
      resp = await ctx.fetch(`${server.origin}/hello`, { cache: 'no-store' });
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.httpVersion, '2.0');
      body = await resp.text();
      assert.strictEqual(body, HELLO_WORLD);
    } finally {
      await ctx.reset();
    }
  });

  it('fetch supports HTTP/2 server push', async () => {
    // returns a promise which resolves with the url and the pushed response
    const pushedResource = () => new Promise((resolve) => {
      const handler = (url, response) => {
        offPush(handler);
        resolve({ url, response });
      };
      onPush(handler);
    });

    // see https://nghttp2.org/blog/2015/02/10/nghttp2-dot-org-enabled-http2-server-push/
    const resp = await fetch('https://nghttp2.org');
    assert.strictEqual(resp.httpVersion, '2.0');
    assert.strictEqual(resp.status, 200);
    assert.strictEqual(resp.headers.get('content-type'), 'text/html');
    let buf = await resp.buffer();
    assert.strictEqual(+resp.headers.get('content-length'), buf.length);
    // pushed resource
    const { url, response } = await pushedResource();
    assert.strictEqual(url, 'https://nghttp2.org/stylesheets/screen.css');
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.headers.get('content-type'), 'text/css');
    buf = await response.buffer();
    assert.strictEqual(+response.headers.get('content-length'), buf.length);
  });

  it('HTTP/2 server push can be disabled', async () => {
    const ctx = context({ h2: { enablePush: false } });

    const handler = sinon.fake();
    ctx.onPush(handler);

    try {
      // see https://nghttp2.org/blog/2015/02/10/nghttp2-dot-org-enabled-http2-server-push/
      const resp = await ctx.fetch('https://nghttp2.org');
      assert.strictEqual(resp.httpVersion, '2.0');
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.headers.get('content-type'), 'text/html');
      const buf = await resp.buffer();
      assert.strictEqual(+resp.headers.get('content-length'), buf.length);
      await sleep(1000);
      assert(handler.notCalled);
    } finally {
      await ctx.reset();
    }
  });

  it('concurrent HTTP/2 requests to same origin', async () => {
    const N = 500; // # of parallel requests
    const TEST_URL = `${server.origin}/bytes`;
    // generete array of 'randomized' urls
    const urls = Array.from({ length: N }, () => Math.floor(Math.random() * N)).map((num) => `${TEST_URL}?count=${num}`);

    const ctx = noCache({ rejectUnauthorized: false });
    try {
      // send requests
      const responses = await Promise.all(urls.map((url) => ctx.fetch(url)));
      // read bodies
      await Promise.all(responses.map((resp) => resp.text()));
      const ok = responses.filter((res) => res.ok && res.httpVersion === '2.0');
      assert.strictEqual(ok.length, N);
    } finally {
      await ctx.reset();
    }
  });

  it('handles concurrent HTTP/2 requests to subdomains sharing the same IP address (using wildcard SAN cert)', async () => {
    // https://github.com/adobe/fetch/issues/52
    const doFetch = async (url) => {
      const res = await fetch(url);
      assert.strictEqual(res.httpVersion, '2.0');
      const data = await res.text();
      return createHash('md5').update(data).digest().toString('hex');
    };

    const results = await Promise.all([
      doFetch('https://en.wikipedia.org/wiki/42'),
      doFetch('https://fr.wikipedia.org/wiki/42'),
      doFetch('https://it.wikipedia.org/wiki/42'),
    ]);

    assert.strictEqual(results.length, 3);
    assert.notStrictEqual(results[0], results[1]);
    assert.notStrictEqual(results[0], results[2]);
    assert.notStrictEqual(results[1], results[2]);
  });

  it('concurrent HTTP/2 requests to same origin using different contexts', async () => {
    const doFetch = async (ctx, url) => ctx.fetch(url);

    const N = 50; // # of parallel requests
    const contexts = Array.from({ length: N }, () => context({ rejectUnauthorized: false }));
    const TEST_URL = `${server.origin}/bytes`;
    // generete array of 'randomized' urls
    const args = contexts
      .map((ctx) => ({ ctx, num: Math.floor(Math.random() * N) }))
      .map(({ ctx, num }) => ({ ctx, url: `${TEST_URL}?count=${num}` }));
    // send requests
    const responses = await Promise.all(args.map(({ ctx, url }) => doFetch(ctx, url)));
    // cleanup
    await Promise.all(contexts.map((ctx) => ctx.reset()));
    const ok = responses.filter((res) => res.ok && res.httpVersion === '2.0');
    assert.strictEqual(ok.length, N);
  });
});
