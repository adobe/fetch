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
const fs = require('fs');
const { finished } = require('stream');
const { promisify } = require('util');

const isStream = require('is-stream');
const { WritableStreamBuffer } = require('stream-buffers');

const { AbortController } = require('../../src/fetch/abort');
const { context, ALPN_HTTP1_1 } = require('../../src/core');
const { RequestAbortedError } = require('../../src/core/errors');

const WOKEUP = 'woke up!';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms, WOKEUP));

const streamFinished = promisify(finished);

const readStream = async (stream) => {
  const out = new WritableStreamBuffer();
  stream.pipe(out);
  return streamFinished(out).then(() => out.getContents());
};

describe('Core Tests', () => {
  let defaultCtx;

  before(async () => {
    defaultCtx = context();
  });

  after(async () => {
    await defaultCtx.reset();
  });

  it('supports HTTP/1(.1)', async () => {
    const resp = await defaultCtx.request('http://httpbin.org/status/200');
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(resp.httpVersionMajor, 1);
  });

  it('supports HTTP/2', async () => {
    let resp = await defaultCtx.request('https://www.nghttp2.org/httpbin/status/200');
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(resp.httpVersionMajor, 2);

    resp = await defaultCtx.request('https://www.nghttp2.org/httpbin/status/201');
    assert.strictEqual(resp.statusCode, 201);
    assert.strictEqual(resp.httpVersionMajor, 2);
  });

  it('throws on unsupported protocol', async () => {
    await assert.rejects(defaultCtx.request('ftp://httpbin.org/'), 'TypeError');
  });

  it('unsupported method', async () => {
    const resp = await defaultCtx.request('https://httpbin.org/status/200', { method: 'BOMB' });
    assert.strictEqual(resp.statusCode, 405);
  });

  it('supports binary response body (Stream)', async () => {
    const dataLen = 64 * 1024; // httpbin.org/stream-bytes/{n} has a limit of 100kb ...
    const contentType = 'application/octet-stream';
    const resp = await defaultCtx.request(`https://httpbin.org/stream-bytes/${dataLen}`, {
      headers: { accept: contentType },
    });
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(resp.headers['content-type'], contentType);
    assert(isStream.readable(resp.readable));

    const buf = await readStream(resp.readable);
    assert.strictEqual(buf.length, dataLen);
  });

  it('supports gzip/deflate/br content encoding (default)', async () => {
    const resp = await defaultCtx.request('https://example.com/');
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(resp.headers['content-encoding'], 'gzip');
  });

  it('supports disabling gzip/deflate/br content encoding', async () => {
    const resp = await defaultCtx.request('https://example.com/', { compress: false });
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(resp.headers['content-encoding'], undefined);
  });

  it('does not overwrite accept-encoding header', async () => {
    const acceptEncoding = 'deflate';
    const headers = { 'accept-encoding': acceptEncoding };
    const resp = await defaultCtx.request('https://httpbin.org/headers', { headers });
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(resp.headers['content-type'], 'application/json');

    const buf = await readStream(resp.readable);
    const json = JSON.parse(buf);
    assert.strictEqual(json.headers['Accept-Encoding'], acceptEncoding);
  });

  it('creating custom context works', async () => {
    const customCtx = context();
    try {
      const resp = await customCtx.request('https://httpbin.org/status/200');
      assert.strictEqual(resp.statusCode, 200);
    } finally {
      await customCtx.reset();
    }
  });

  it('AbortController works (premature abort)', async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 0);
    const { signal } = controller;

    // make sure signal has fired
    await sleep(10);
    assert(signal.aborted);

    const ts0 = Date.now();
    try {
      await defaultCtx.request('https://httpbin.org/status/200', { signal });
      assert.fail();
    } catch (err) {
      assert(err instanceof RequestAbortedError);
    }
    const ts1 = Date.now();
    assert((ts1 - ts0) < 10);
  });

  it('AbortController works (premature abort, fresh context)', async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 0);
    const { signal } = controller;

    // make sure signal has fired
    await sleep(10);
    assert(signal.aborted);

    const customCtx = context();

    const ts0 = Date.now();
    try {
      await customCtx.request('https://httpbin.org/status/200', { signal });
      assert.fail();
    } catch (err) {
      assert(err instanceof RequestAbortedError);
    } finally {
      await customCtx.reset();
    }
    const ts1 = Date.now();
    assert((ts1 - ts0) < 10);
  });

  it('AbortController works (slow response)', async function test() {
    this.timeout(5000);

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 1000);
    const { signal } = controller;

    const ts0 = Date.now();
    try {
      // the server responds with a 2 second delay, fetch is aborted after 1 second.
      await defaultCtx.request('https://httpbin.org/delay/2', { signal });
      assert.fail();
    } catch (err) {
      assert(err instanceof RequestAbortedError);
    }
    const ts1 = Date.now();
    assert((ts1 - ts0) < 1000 * 1.1);
  });

  it('AbortController works (slow connect)', async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 1000);
    const { signal } = controller;

    const ts0 = Date.now();
    try {
      // the TLS connect to the server hangs, fetch is aborted after 1 second.
      await defaultCtx.request('https://example.com:81/', { signal });
      assert.fail();
    } catch (err) {
      assert(err instanceof RequestAbortedError);
    }
    const ts1 = Date.now();
    assert((ts1 - ts0) < 1000 * 1.1);
  });

  it('overriding user-agent works (context)', async () => {
    const customUserAgent = 'custom-agent';
    const customCtx = context({
      userAgent: customUserAgent,
    });
    try {
      const resp = await customCtx.request('https://httpbin.org/user-agent');
      assert.strictEqual(resp.statusCode, 200);
      assert.strictEqual(resp.headers['content-type'], 'application/json');

      const buf = await readStream(resp.readable);
      const json = JSON.parse(buf);
      assert.strictEqual(json['user-agent'], customUserAgent);
    } finally {
      customCtx.reset();
    }
  });

  it('overriding user-agent works (header)', async () => {
    const customUserAgent = 'custom-agent';
    const opts = {
      headers: { 'user-agent': customUserAgent },
    };
    const resp = await defaultCtx.request('https://httpbin.org/user-agent', opts);
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(resp.headers['content-type'], 'application/json');

    const buf = await readStream(resp.readable);
    const json = JSON.parse(buf);
    assert.strictEqual(json['user-agent'], customUserAgent);
  });

  it('forcing HTTP/1.1 works', async () => {
    // endpoint supporting http2 & http1
    const url = 'https://www.nghttp2.org/httpbin/status/200';
    // default context defaults to http2
    let resp = await defaultCtx.request(url);
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(resp.httpVersionMajor, 2);

    // custom context forces http1
    const h1Ctx = context({
      alpnProtocols: [ALPN_HTTP1_1],
    });
    try {
      resp = await h1Ctx.request(url);
      assert.strictEqual(resp.statusCode, 200);
      assert.strictEqual(resp.httpVersionMajor, 1);
      assert.strictEqual(resp.httpVersionMinor, 1);
    } finally {
      h1Ctx.reset();
    }
  });

  it('supports parallel requests', async () => {
    const N = 100; // # of parallel requests
    const TEST_URL = 'https://httpbin.org/bytes/'; // HTTP2
    // generete array of 'randomized' urls
    const urls = Array.from({ length: N }, () => Math.floor(Math.random() * N)).map((num) => `${TEST_URL}${num}`);

    // custom context to isolate from side effects of other tests
    const ctx = context();
    try {
      // send requests
      const responses = await Promise.all(urls.map((url) => ctx.request(url)));
      // read bodies
      await Promise.all(responses.map((resp) => readStream(resp.readable)));
      const ok = responses.filter((res) => res.statusCode === 200);
      assert.strictEqual(ok.length, N);
    } finally {
      ctx.reset();
    }
  });

  it('supports json POST', async () => {
    const method = 'POST';
    const body = { foo: 'bar' };
    const resp = await defaultCtx.request('https://httpbin.org/post', { method, body });
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(resp.headers['content-type'], 'application/json');
    const buf = await readStream(resp.readable);
    const jsonResponseBody = JSON.parse(buf);
    assert(typeof jsonResponseBody === 'object');
    assert.deepStrictEqual(jsonResponseBody.json, body);
  });

  it('supports json POST (override content-type)', async () => {
    const method = 'POST';
    const body = { foo: 'bar' };
    const contentType = 'application/x-javascript';
    const headers = { 'content-type': contentType };
    const resp = await defaultCtx.request('https://httpbin.org/post', { method, body, headers });
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(resp.headers['content-type'], 'application/json');
    const buf = await readStream(resp.readable);
    const jsonResponseBody = JSON.parse(buf);
    assert(typeof jsonResponseBody === 'object');
    assert.strictEqual(jsonResponseBody.headers['Content-Type'], contentType);
    assert.deepStrictEqual(jsonResponseBody.json, body);
  });

  it('supports text body', async () => {
    const method = 'POST';
    const body = 'hello, world!';
    const resp = await defaultCtx.request('https://httpbin.org/post', { method, body });
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(resp.headers['content-type'], 'application/json');
    const buf = await readStream(resp.readable);
    const jsonResponseBody = JSON.parse(buf);
    assert(typeof jsonResponseBody === 'object');
    assert.strictEqual(jsonResponseBody.headers['Content-Type'], 'text/plain; charset=utf-8');
    assert.deepStrictEqual(jsonResponseBody.data, body);
  });

  it('supports text body (html)', async () => {
    const method = 'POST';
    const body = '<h1>hello, world!</h1>';
    const contentType = 'text/html; charset=utf-8';
    const headers = { 'content-type': contentType };
    const resp = await defaultCtx.request('https://httpbin.org/post', { method, body, headers });
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(resp.headers['content-type'], 'application/json');
    const buf = await readStream(resp.readable);
    const jsonResponseBody = JSON.parse(buf);
    assert(typeof jsonResponseBody === 'object');
    assert.strictEqual(jsonResponseBody.headers['Content-Type'], contentType);
    assert.deepStrictEqual(jsonResponseBody.data, body);
  });

  it('supports stream body', async () => {
    const method = 'POST';
    const body = fs.createReadStream(__filename);
    const resp = await defaultCtx.request('https://httpbin.org/post', { method, body });
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(resp.headers['content-type'], 'application/json');
    const buf = await readStream(resp.readable);
    const jsonResponseBody = JSON.parse(buf);
    assert(typeof jsonResponseBody === 'object');
    assert.deepStrictEqual(jsonResponseBody.data, fs.readFileSync(__filename).toString());
  });

  it('supports URLSearchParams body', async () => {
    const params = {
      name: 'André Citroën',
      rumple: 'stiltskin',
    };
    const method = 'POST';
    const body = new URLSearchParams(params);
    const resp = await defaultCtx.request('https://httpbin.org/post', { method, body });
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(resp.headers['content-type'], 'application/json');
    const buf = await readStream(resp.readable);
    const jsonResponseBody = JSON.parse(buf);
    assert(typeof jsonResponseBody === 'object');
    assert.strictEqual(jsonResponseBody.headers['Content-Type'], 'application/x-www-form-urlencoded; charset=utf-8');
    assert.deepStrictEqual(jsonResponseBody.form, params);
  });

  it('supports POST without body', async () => {
    const method = 'POST';
    const resp = await defaultCtx.request('https://httpbin.org/post', { method });
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(resp.headers['content-type'], 'application/json');
    const buf = await readStream(resp.readable);
    const jsonResponseBody = JSON.parse(buf);
    assert(typeof jsonResponseBody === 'object');
    assert.strictEqual(+jsonResponseBody.headers['Content-Length'], 0);
  });

  it('supports gzip content encoding', async () => {
    const resp = await defaultCtx.request('https://httpbin.org/gzip');
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(resp.headers['content-type'], 'application/json');
    const buf = await readStream(resp.readable);
    const jsonResponseBody = JSON.parse(buf);
    assert(typeof jsonResponseBody === 'object');
    assert.strictEqual(jsonResponseBody.gzipped, true);
  });

  it('supports deflate content encoding', async () => {
    const resp = await defaultCtx.request('https://httpbin.org/deflate');
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(resp.headers['content-type'], 'application/json');
    const buf = await readStream(resp.readable);
    const jsonResponseBody = JSON.parse(buf);
    assert(typeof jsonResponseBody === 'object');
    assert.strictEqual(jsonResponseBody.deflated, true);
  });

  it('supports brotli content encoding', async () => {
    const resp = await defaultCtx.request('https://httpbin.org/brotli');
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(resp.headers['content-type'], 'application/json');
    const buf = await readStream(resp.readable);
    const jsonResponseBody = JSON.parse(buf);
    assert(typeof jsonResponseBody === 'object');
    assert.strictEqual(jsonResponseBody.brotli, true);
  });

  it('supports HTTP/2 server push', async () => {
    let customCtx;
    const pushedResource = new Promise((resolve) => {
      const pushHandler = (url, headers, response) => {
        resolve({ url, response });
      };
      customCtx = context({ h2: { pushHandler } });
    });

    try {
      // see https://nghttp2.org/blog/2015/02/10/nghttp2-dot-org-enabled-http2-server-push/
      const resp = await customCtx.request('https://nghttp2.org');
      assert.strictEqual(resp.httpVersionMajor, 2);
      assert.strictEqual(resp.statusCode, 200);
      assert.strictEqual(resp.headers['content-type'], 'text/html');
      let buf = await readStream(resp.readable);
      assert.strictEqual(+resp.headers['content-length'], buf.length);
      // pushed resource
      const { url, response } = await pushedResource;
      assert.strictEqual(url, 'https://nghttp2.org/stylesheets/screen.css');
      assert.strictEqual(response.statusCode, 200);
      assert.strictEqual(response.headers['content-type'], 'text/css');
      buf = await readStream(response.readable);
      assert.strictEqual(+response.headers['content-length'], buf.length);
    } finally {
      await customCtx.reset();
    }
  });

  it('HTTP/2 server push can be rejected', async function test() {
    this.timeout(5000);

    const pushPromiseHandler = (url, headers, reject) => {
      // we're not interested, cancel push promise
      reject();
    };

    let customCtx;
    const pushedResource = new Promise((resolve) => {
      // eslint-disable-next-line no-unused-vars
      const pushHandler = (url, headers, response) => {
        resolve(url);
      };
      customCtx = context({ h2: { pushPromiseHandler, pushHandler } });
    });

    try {
      // see https://nghttp2.org/blog/2015/02/10/nghttp2-dot-org-enabled-http2-server-push/
      const resp = await customCtx.request('https://nghttp2.org');
      assert.strictEqual(resp.httpVersionMajor, 2);
      assert.strictEqual(resp.statusCode, 200);
      assert.strictEqual(resp.headers['content-type'], 'text/html');
      const buf = await readStream(resp.readable);
      assert.strictEqual(+resp.headers['content-length'], buf.length);

      // resolves with either WOKEUP or the url of the pushed resource
      const result = await Promise.race([sleep(2000), pushedResource]);
      assert.strictEqual(result, WOKEUP);
    } finally {
      await customCtx.reset();
    }
  });

  it('supports timeout for idle pushed streams', async () => {
    let customCtx;
    const pushedResource = new Promise((resolve) => {
      const pushHandler = (url, headers, response) => {
        resolve({ url, headers, response });
      };
      // automatically close idle pushed streams after 100ms
      // without this setting the test will timeout after 2000ms while
      // waiting on customCtx.reset()
      customCtx = context({ h2: { pushHandler, pushedStreamIdleTimeout: 100 } });
    });

    try {
      // see https://nghttp2.org/blog/2015/02/10/nghttp2-dot-org-enabled-http2-server-push/
      const resp = await customCtx.request('https://nghttp2.org');
      assert.strictEqual(resp.httpVersionMajor, 2);
      assert.strictEqual(resp.statusCode, 200);
      assert.strictEqual(resp.headers['content-type'], 'text/html');
      const buf = await readStream(resp.readable);
      assert.strictEqual(+resp.headers['content-length'], buf.length);
      // pushed resource
      const { url, response } = await pushedResource;
      assert.strictEqual(url, 'https://nghttp2.org/stylesheets/screen.css');
      assert.strictEqual(response.statusCode, 200);
      assert.strictEqual(response.headers['content-type'], 'text/css');
      // don't consume pushed stream in order to trigger the timeout for idle pushed streams
    } finally {
      await customCtx.reset();
    }
  });
});
