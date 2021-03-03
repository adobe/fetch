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

'use strict';

const assert = require('assert');
const crypto = require('crypto');
const http2 = require('http2');
const util = require('util');

const pem = require('pem');
const sinon = require('sinon');

const {
  fetch,
  context,
  reset,
  onPush,
  offPush,
} = require('../../src/fetch');

const createCertificate = util.promisify(pem.createCertificate);

const WOKEUP = 'woke up!';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms, WOKEUP));

const HELLO_WORLD = 'Hello, World!';

class H2Server {
  constructor() {
    this.server = null;
    this.sessions = new Set();
  }

  async start(port = 0) {
    if (this.server) {
      throw Error('server already started');
    }
    const keys = await createCertificate({ selfSigned: true });
    const server = http2.createSecureServer({
      key: keys.serviceKey,
      cert: keys.certificate,
    });
    server.once('error', (err) => {
      throw err;
    });
    server.once('close', () => {
      this.server = null;
      this.sessions.clear();
    });
    server.on('session', (session) => this.sessions.add(session));
    server.on('stream', (stream, headers) => {
      const { pathname } = new URL(`${headers[':scheme']}://${headers[':authority']}${headers[':path']}`);
      switch (pathname) {
        case '/hello':
          stream.respond({ ':status': 200 });
          stream.end(HELLO_WORLD);
          break;

        default:
          stream.respond({ ':status': 404 });
          stream.end('Not found!');
      }
    });
    return new Promise((resolve) => {
      server.listen(port, () => {
        this.server = server;
        resolve();
      });
    });
  }

  get port() {
    if (!this.server) {
      throw Error('server not started');
    }
    return this.server.address().port;
  }

  get origin() {
    const { port } = this;
    return `https://localhost:${port}`;
  }

  async destroy() {
    if (!this.server) {
      throw Error('server not started');
    }
    for (const session of this.sessions) {
      session.destroy();
      this.sessions.delete(session);
    }
    return new Promise((resolve) => this.server.close(resolve));
  }

  async restart() {
    if (!this.server) {
      throw Error('server not started');
    }
    const { port } = this;
    await this.destroy();
    return this.start(port);
  }

  async close() {
    if (!this.server) {
      throw Error('server not started');
    }
    return new Promise((resolve) => this.server.close(resolve));
  }
}

describe('HTTP/2-specific Fetch Tests', () => {
  let server;
  let origin;

  before(async () => {
    // start test server
    server = new H2Server();
    await server.start();
    origin = server.origin;
  });

  after(async () => {
    await server.close();
  });

  afterEach(async () => {
    await reset();
  });

  it('supports self signed certificate', async () => {
    // self signed certificates are rejected by default
    assert.rejects(() => fetch(`${origin}/hello`));

    const ctx = context({ rejectUnauthorized: false });
    try {
      const resp = await ctx.fetch(`${origin}/hello`);
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.httpVersion, '2.0');
      const body = await resp.text();
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

  it('HTTP/2 server push can be disabled', async function test() {
    this.timeout(5000);

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

  it('concurrent HTTP/2 requests to same origin', async function test() {
    this.timeout(5000);

    const N = 500; // # of parallel requests
    const TEST_URL = 'https://httpbin.org/bytes/'; // HTTP2
    // generete array of 'randomized' urls
    const urls = Array.from({ length: N }, () => Math.floor(Math.random() * N)).map((num) => `${TEST_URL}${num}`);
    // send requests
    const responses = await Promise.all(urls.map((url) => fetch(url)));
    // read bodies
    await Promise.all(responses.map((resp) => resp.text()));
    const ok = responses.filter((res) => res.ok && res.httpVersion === '2.0');
    assert.strictEqual(ok.length, N);
  });

  it('handles concurrent HTTP/2 requests to subdomains sharing the same IP address (using wildcard SAN cert)', async () => {
    // https://github.com/adobe/helix-fetch/issues/52
    const doFetch = async (url) => {
      const res = await fetch(url);
      assert.strictEqual(res.httpVersion, '2.0');
      const data = await res.text();
      return crypto.createHash('md5').update(data).digest().toString('hex');
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
});
