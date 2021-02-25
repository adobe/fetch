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
const { Readable } = require('stream');

const isStream = require('is-stream');
const nock = require('nock');
const parseCacheControl = require('parse-cache-control');

const {
  fetch, onPush, offPush, reset, clearCache, cacheStats, context, Response, Headers,
} = require('../../src');
const { cacheableResponse } = require('../../src/fetch/cacheableResponse');

const WOKEUP = 'woke up!';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms, WOKEUP));

describe('CacheableResponse Tests', () => {
  it('supports cacheable Response', async () => {
    const body = Readable.from('a=1');
    const r = new Response(body, {
      headers: {
        a: '1',
      },
      url: 'http://example.com/',
      status: 200,
      statusText: 'OK',
    });
    const cr = await cacheableResponse(r);
    assert.strictEqual(Object.prototype.toString.call(cr), '[object CacheableResponse]');
    assert.strictEqual(r.status, cr.status);
    assert.strictEqual(r.headers.get('a'), '1');
    assert.strictEqual(r.headers.get('a'), cr.headers.get('a'));
    assert.strictEqual(r.bodyUsed, true);
    assert.strictEqual(cr.bodyUsed, false);
    assert.strictEqual(await cr.text(), 'a=1');
    assert.strictEqual(cr.bodyUsed, false);
    assert.strictEqual(await cr.text(), 'a=1');
    assert.throws(() => {
      cr.headers = { foo: 'bar' };
    }, 'TypeError');
    cr.headers = new Headers({ foo: 'bar' });
    assert.strictEqual(cr.headers.get('foo'), 'bar');
  });
});

describe('Cache Tests', () => {
  afterEach(async () => {
    // clear client cache
    clearCache();
    // disconnect all sessions
    await reset();
  });

  it('fetch supports caching', async () => {
    const url = 'https://httpbin.org/cache/60'; // -> max-age=60 (seconds)
    // send initial request, priming cache
    let resp = await fetch(url);
    assert.strictEqual(resp.status, 200);

    // re-send request and make sure it's served from cache
    resp = await fetch(url);
    assert.strictEqual(resp.status, 200);
    assert(resp.fromCache);

    // re-send request, this time with network disabled
    nock.disableNetConnect();
    try {
      resp = await fetch(url);
      assert.strictEqual(resp.status, 200);
      assert(resp.fromCache);
    } finally {
      nock.cleanAll();
      nock.enableNetConnect();
    }

    // re-send request, this time with cache disabled via option
    resp = await fetch(url, { cache: 'no-store' });
    assert.strictEqual(resp.status, 200);
    assert(!resp.fromCache);
  });

  it('clearCache works', async () => {
    const url = 'https://httpbin.org/cache/60'; // -> max-age=60 (seconds)
    // send initial request, priming cache
    let resp = await fetch(url);
    assert.strictEqual(resp.status, 200);
    const cc = parseCacheControl(resp.headers.get('cache-control'));
    assert(cc);
    assert.strictEqual(cc['max-age'], 60);

    // re-send request and make sure it's served from cache
    resp = await fetch(url);
    assert.strictEqual(resp.status, 200);
    assert(resp.fromCache);

    // clear client cache
    clearCache();

    const { size, count } = cacheStats();
    assert.strictEqual(size, 0);
    assert.strictEqual(count, 0);

    // re-send request, make sure it's returning a fresh response
    resp = await fetch(url);
    assert.strictEqual(resp.status, 200);
    assert(!resp.fromCache);
  });

  it('cache size limit is configurable', async () => {
    const maxCacheSize = 100 * 1024; // 100kb
    // custom context with cache size limit
    const ctx = context({ maxCacheSize });

    const sizes = [34 * 1024, 35 * 1024, 36 * 1024]; // sizes add up to >100kb
    const urls = sizes.map((size) => `http://httpbin.org/bytes/${size}`);
    // prime cache with multiple requests that together hit the cache size limit of 100kb
    const resps = await Promise.all(urls.map((url) => ctx.fetch(url)));
    assert.strictEqual(resps.filter((resp) => resp.status === 200).length, urls.length);

    const { size, count } = ctx.cacheStats();
    assert(size < maxCacheSize);
    assert.strictEqual(count, urls.length - 1);

    ctx.clearCache();
    await ctx.reset();
  });

  it('fetch supports max-age directive', async function test() {
    this.timeout(5000);

    // max-age=3 seconds
    const url = 'https://httpbin.org/cache/3';
    // send request
    let resp = await fetch(url);
    assert.strictEqual(resp.status, 200);
    const cc = parseCacheControl(resp.headers.get('cache-control'));
    assert(cc);
    assert.strictEqual(cc['max-age'], 3);
    // wait a second...
    await sleep(1000);
    // re-send request and make sure it's served from cache
    resp = await fetch(url);
    assert.strictEqual(resp.status, 200);
    assert(parseInt(resp.headers.get('age'), 10) > 0);
    assert(resp.fromCache);
    // wait another 2 seconds to make sure max-age expires...
    await sleep(2000);
    // re-send request and make sure it's not served from cache
    resp = await fetch(url);
    assert.strictEqual(resp.status, 200);
    assert(!resp.fromCache);
  });

  it('fetch supports max-age=0', async () => {
    const url = 'https://httpbin.org/cache/0';
    let resp = await fetch(url);
    assert.strictEqual(resp.status, 200);
    const cc = parseCacheControl(resp.headers.get('cache-control'));
    assert.strictEqual(cc['max-age'], 0);
    // re-send request and make sure it's not served from cache
    resp = await fetch(url);
    assert.strictEqual(resp.status, 200);
    assert(!resp.fromCache);
  });

  it('fetch supports no-store directive', async () => {
    // send request with no-store directive
    const resp = await fetch('https://httpbin.org/image/jpeg', { headers: { 'cache-control': 'no-store' } });
    assert.strictEqual(resp.status, 200);
    assert(!resp.fromCache);
  });

  it('buffer() et al work on un-cached response', async () => {
    // send initial request with no-store directive
    let resp = await fetch('https://httpbin.org/image/jpeg', { cache: 'no-store' });
    assert.strictEqual(resp.status, 200);
    // re-send request
    resp = await fetch('https://httpbin.org/image/jpeg', { cache: 'no-store' });
    assert.strictEqual(resp.status, 200);
    // make sure it's not delivered from cache
    assert(!resp.fromCache);

    // buffer()
    const buf = await resp.buffer();
    assert(Buffer.isBuffer(buf));
    const contentLength = +resp.headers.get('content-length');
    assert.strictEqual(buf.length, contentLength);
  });

  it('body (stream) works on un-cached response', async () => {
    const url = 'https://httpbin.org/image/jpeg';
    // send initial request with no-store directive
    let resp = await fetch(url, { cache: 'no-store' });
    assert.strictEqual(resp.status, 200);
    // re-send request
    resp = await fetch(url, { cache: 'no-store' });
    assert.strictEqual(resp.status, 200);
    // make sure it's not delivered from cache
    assert(!resp.fromCache);

    // body
    assert(isStream.readable(resp.body));
  });

  it('text() works on un-cached response', async () => {
    const url = 'https://httpbin.org/get';
    // send initial request with no-store directive
    let resp = await fetch(url, { cache: 'no-store' });
    assert.strictEqual(resp.status, 200);
    // re-send request
    resp = await fetch(url, { cache: 'no-store' });
    assert.strictEqual(resp.status, 200);
    // make sure it's not delivered from cache
    assert(!resp.fromCache);

    // text()
    assert.doesNotReject(() => resp.text());
  });

  it('arrayBuffer() works on un-cached response', async () => {
    const url = 'https://httpbin.org/get';
    // send initial request with no-store directive
    let resp = await fetch(url, { cache: 'no-store' });
    assert.strictEqual(resp.status, 200);
    // re-send request
    resp = await fetch(url, { cache: 'no-store' });
    assert.strictEqual(resp.status, 200);
    const contentLength = +resp.headers.get('content-length');
    // make sure it's not delivered from cache
    assert(!resp.fromCache);

    // arrayBuffer()
    const arrBuf = await resp.arrayBuffer();
    assert(arrBuf instanceof ArrayBuffer);
    assert.strictEqual(arrBuf.byteLength, contentLength);
  });

  it('json() works on un-cached response', async () => {
    const url = 'https://httpbin.org/get';
    // send initial request with no-store directive
    let resp = await fetch(url, { cache: 'no-store' });
    assert.strictEqual(resp.status, 200);
    // re-send request
    resp = await fetch(url, { cache: 'no-store' });
    assert.strictEqual(resp.status, 200);
    // make sure it's not delivered from cache
    assert(!resp.fromCache);

    // json()
    assert.strictEqual(resp.headers.plain()['content-type'], 'application/json');
    const json = await resp.json();
    assert.strictEqual(json.url, url);
  });

  it('body accessor methods work on cached response', async () => {
    const url = 'https://httpbin.org/cache/60';
    // send initial request, priming cache
    let resp = await fetch(url);
    assert.strictEqual(resp.status, 200);
    // re-send request, to be delivered from cache
    resp = await fetch(url);
    assert.strictEqual(resp.status, 200);
    // make sure it's delivered from cache
    assert(resp.fromCache);

    const buf = await resp.buffer();
    assert(Buffer.isBuffer(buf));
    const contentLength = +resp.headers.get('content-length');
    assert.strictEqual(buf.length, contentLength);

    const arrBuf = await resp.arrayBuffer();
    assert(arrBuf instanceof ArrayBuffer);
    assert.strictEqual(arrBuf.byteLength, contentLength);

    assert(isStream.readable(resp.body));

    assert.strictEqual(resp.headers.plain()['content-type'], 'application/json');
    const json = await resp.json();
    assert.strictEqual(json.url, url);

    assert.deepStrictEqual(JSON.parse(await resp.text()), json);
  });

  it('fetch supports HTTP/2 server push', async function test() {
    this.timeout(5000);

    // returns a promise which resolves with the url of the pushed resource
    const receivedPush = () => new Promise((resolve) => {
      // eslint-disable-next-line no-unused-vars
      const handler = (url, response) => {
        offPush(handler);
        resolve(url);
      };
      onPush(handler);
    });

    const [resp, url] = await Promise.all([
      // see https://nghttp2.org/blog/2015/02/10/nghttp2-dot-org-enabled-http2-server-push/
      fetch('https://nghttp2.org'),
      // resolves with either WOKEUP or the url of the pushed resource
      Promise.race([sleep(2000), receivedPush()]),
    ]);
    assert.strictEqual(resp.httpVersion, '2.0');
    assert.strictEqual(resp.status, 200);
    assert.strictEqual(resp.headers.get('content-type'), 'text/html');
    assert.strictEqual(+resp.headers.get('content-length'), (await resp.text()).length);
    assert.notStrictEqual(url, WOKEUP);

    // check cache for pushed resource (stylesheets/screen.css)
    nock.disableNetConnect();
    try {
      const pushedResp = await fetch(url);
      assert.strictEqual(pushedResp.httpVersion, '2.0');
      assert.strictEqual(pushedResp.status, 200);
      assert(pushedResp.fromCache);
    } finally {
      nock.cleanAll();
      nock.enableNetConnect();
    }
  });

  it('test redundant server push', async function test() {
    this.timeout(5000);

    let pushedResponse;
    const receivedPush = () => new Promise((resolve) => onPush((url, response) => {
      pushedResponse = response;
      resolve(response);
    }));

    let [resp, result] = await Promise.all([
      // see https://nghttp2.org/blog/2015/02/10/nghttp2-dot-org-enabled-http2-server-push/
      fetch('https://nghttp2.org', { cache: 'no-store' }),
      // resolves with either WOKEUP or a Response representing the pushed resource
      Promise.race([sleep(3000), receivedPush()]),
    ]);
    assert.strictEqual(resp.httpVersion, '2.0');
    assert.strictEqual(resp.status, 200);
    assert(!resp.fromCache);
    assert.notStrictEqual(result, WOKEUP);
    // result is a Response representing the pushed resource
    assert.strictEqual(result, pushedResponse);

    // fetch again -> push rejected since resource is already cached
    [resp, result] = await Promise.all([
      fetch('https://nghttp2.org', { cache: 'no-store' }),
      Promise.race([sleep(3000), receivedPush()]),
    ]);
    assert.strictEqual(resp.httpVersion, '2.0');
    assert.strictEqual(resp.status, 200);
    assert(!resp.fromCache);
    assert.strictEqual(result, WOKEUP);

    // fetch pushed resource -> should be delivered from cache
    resp = await fetch(pushedResponse.url);
    assert.strictEqual(resp.httpVersion, '2.0');
    assert.strictEqual(resp.status, 200);
    assert.strictEqual(resp.fromCache, true);
  });

  it('resp.headers is wrapped on cached response', async () => {
    const resp = await fetch('https://httpbin.org/put', {
      method: 'PUT',
      body: JSON.stringify({ foo: 'bar' }),
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
    });
    assert.strictEqual(resp.status, 200);
    assert.strictEqual(resp.headers.plain()['content-type'], 'application/json');
    const json = await resp.json();
    assert(json !== null && typeof json === 'object');
  });
});
