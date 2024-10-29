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
/* eslint-disable no-underscore-dangle */

import assert from 'assert';
import fs from 'fs';
import { finished } from 'stream';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

import { FormData } from 'formdata-node';
import { WritableStreamBuffer } from 'stream-buffers';

import { isReadableStream, parseMultiPartFormData } from '../utils.js';
import { AbortController } from '../../src/fetch/abort.js';
import { RequestAbortedError } from '../../src/core/errors.js';
import core from '../../src/core/index.js';
import Server from '../server.js';

const HELLO_WORLD = 'Hello, World!';

const { context, ALPN_HTTP1_1 } = core;

// Workaround for ES6 which doesn't support the NodeJS global __filename
const __filename = fileURLToPath(import.meta.url);

const WOKEUP = 'woke up!';
const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms, WOKEUP);
});

const streamFinished = promisify(finished);

const readStream = async (stream) => {
  const out = new WritableStreamBuffer();
  stream.pipe(out);
  return streamFinished(out).then(() => out.getContents());
};

describe('Core Tests', () => {
  let defaultCtx;
  let server;

  before(async () => {
    defaultCtx = context({ rejectUnauthorized: false });
    server = await Server.launch(2, true, HELLO_WORLD);
  });

  after(async () => {
    await defaultCtx.reset();
    process.kill(server.pid);
  });

  it('supports HTTP/1(.1)', async () => {
    // start HTTP/1.1 server
    const h1Server = await Server.launch(1);

    try {
      const resp = await defaultCtx.request(`${h1Server.origin}/status/200`);
      assert.strictEqual(resp.statusCode, 200);
      assert.strictEqual(resp.httpVersionMajor, 1);
    } finally {
      process.kill(h1Server.pid);
    }
  });

  it('supports HTTP/2', async () => {
    let resp = await defaultCtx.request(`${server.origin}/status/200`);
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(resp.httpVersionMajor, 2);

    resp = await defaultCtx.request(`${server.origin}/status/204`);
    assert.strictEqual(resp.statusCode, 204);
    assert.strictEqual(resp.httpVersionMajor, 2);
  });

  it('throws on unsupported protocol', async () => {
    await assert.rejects(defaultCtx.request('ftp://example.com/'), 'TypeError');
  });

  it('unsupported method', async () => {
    const resp = await defaultCtx.request('https://fetch.spec.whatwg.org/', { method: 'BOMB' });
    assert.strictEqual(resp.statusCode, 405);
  });

  it('supports binary response body (Stream)', async () => {
    const dataLen = 128 * 1024;
    const contentType = 'application/octet-stream';
    const resp = await defaultCtx.request(`${server.origin}/stream-bytes?count=${dataLen}`, {
      headers: { accept: contentType },
    });
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(resp.headers['content-type'], contentType);
    assert(isReadableStream(resp.readable));

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

  it('supports gzip/deflate/br content decoding (default)', async () => {
    const resp = await defaultCtx.request('https://example.com/');
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(resp.headers['content-encoding'], 'gzip');
    assert(isReadableStream(resp.readable));
    const buf = await readStream(resp.readable);
    const body = buf.toString();
    assert(body.startsWith('<!doctype html>'));
    assert(+resp.headers['content-length'] < body.length);
    assert.strictEqual(resp.decoded, true);
  });

  it('supports disabling gzip/deflate/br content decoding', async () => {
    const resp = await defaultCtx.request('https://example.com/', { decode: false });
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(resp.headers['content-encoding'], 'gzip');
    assert(isReadableStream(resp.readable));
    const buf = await readStream(resp.readable);
    assert.strictEqual(+resp.headers['content-length'], buf.length);
    assert.strictEqual(resp.decoded, false);
  });

  it('does not overwrite accept-encoding header', async () => {
    const acceptEncoding = 'deflate';
    const headers = { 'accept-encoding': acceptEncoding };
    const resp = await defaultCtx.request(`${server.origin}/inspect`, { headers });
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(resp.headers['content-type'], 'application/json');

    const buf = await readStream(resp.readable);
    const json = JSON.parse(buf);
    assert.strictEqual(json.headers['accept-encoding'], acceptEncoding);
  });

  it('creating custom context works', async () => {
    const customCtx = context({ rejectUnauthorized: false });
    try {
      const resp = await customCtx.request(`${server.origin}/status/200`);
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
      await defaultCtx.request(`${server.origin}/status/200`, { signal });
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

    const customCtx = context({ rejectUnauthorized: false });

    const ts0 = Date.now();
    try {
      await customCtx.request(`${server.origin}/status/200`, { signal });
      assert.fail();
    } catch (err) {
      assert(err instanceof RequestAbortedError);
    } finally {
      await customCtx.reset();
    }
    const ts1 = Date.now();
    assert((ts1 - ts0) < 10);
  });

  it('AbortController works (slow response)', async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 1000);
    const { signal } = controller;

    const ts0 = Date.now();
    try {
      // the server responds with a 2 second delay, fetch is aborted after 1 second.
      await defaultCtx.request(`${server.origin}/status/200?delay=2000`, { signal });
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
      rejectUnauthorized: false,
      userAgent: customUserAgent,
    });
    try {
      const resp = await customCtx.request(`${server.origin}/inspect`);
      assert.strictEqual(resp.statusCode, 200);
      assert.strictEqual(resp.headers['content-type'], 'application/json');

      const buf = await readStream(resp.readable);
      const json = JSON.parse(buf);
      assert.strictEqual(json.headers['user-agent'], customUserAgent);
    } finally {
      await customCtx.reset();
    }
  });

  it('overriding user-agent works (header)', async () => {
    const customUserAgent = 'custom-agent';
    const opts = {
      headers: { 'user-agent': customUserAgent },
    };
    const resp = await defaultCtx.request(`${server.origin}/inspect`, opts);
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(resp.headers['content-type'], 'application/json');

    const buf = await readStream(resp.readable);
    const json = JSON.parse(buf);
    assert.strictEqual(json.headers['user-agent'], customUserAgent);
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
      await h1Ctx.reset();
    }
  });

  it('supports parallel requests', async () => {
    const N = 100; // # of parallel requests

    // start secure HTTP/2 server
    const testServer = await Server.launch(2, true);

    const TEST_URL = `${testServer.origin}/bytes`;
    // generete array of 'randomized' urls
    const urls = Array.from({ length: N }, () => Math.floor(Math.random() * N)).map((num) => `${TEST_URL}?count=${num}`);

    // custom context to isolate from side effects of other tests
    const ctx = context({ rejectUnauthorized: false });
    try {
      // send requests
      const responses = await Promise.all(urls.map((url) => ctx.request(url)));
      // read bodies
      await Promise.all(responses.map((resp) => readStream(resp.readable)));
      const ok = responses.filter((res) => res.statusCode === 200);
      assert.strictEqual(ok.length, N);
    } finally {
      await ctx.reset();
      process.kill(testServer.pid);
    }
  });

  it('supports json POST', async () => {
    const method = 'POST';
    const body = { foo: 'bar' };
    const resp = await defaultCtx.request(`${server.origin}/inspect`, { method, body });
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(resp.headers['content-type'], 'application/json');
    const buf = await readStream(resp.readable);
    const json = JSON.parse(buf);
    assert(typeof json === 'object');
    assert.strictEqual(json.method, method);
    assert.strictEqual(json.headers['content-type'], 'application/json');
    assert.strictEqual(+json.headers['content-length'], JSON.stringify(body).length);
    assert.deepStrictEqual(JSON.parse(json.body), body);
  });

  it('supports json POST (override content-type)', async () => {
    const method = 'POST';
    const body = { foo: 'bar' };
    const contentType = 'application/x-javascript';
    const headers = { 'content-type': contentType };
    const resp = await defaultCtx.request(`${server.origin}/inspect`, { method, body, headers });
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(resp.headers['content-type'], 'application/json');
    const buf = await readStream(resp.readable);
    const json = JSON.parse(buf);
    assert(typeof json === 'object');
    assert.strictEqual(json.method, method);
    assert.strictEqual(json.headers['content-type'], contentType);
    assert.strictEqual(+json.headers['content-length'], JSON.stringify(body).length);
    assert.deepStrictEqual(JSON.parse(json.body), body);
  });

  it('supports text body', async () => {
    const method = 'POST';
    const body = 'Hello, World!';
    const resp = await defaultCtx.request(`${server.origin}/inspect`, { method, body });
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(resp.headers['content-type'], 'application/json');
    const buf = await readStream(resp.readable);
    const json = JSON.parse(buf);
    assert(typeof json === 'object');
    assert.strictEqual(json.method, method);
    assert.strictEqual(json.headers['content-type'], 'text/plain; charset=utf-8');
    assert.strictEqual(+json.headers['content-length'], body.length);
    assert.strictEqual(json.body, body);
  });

  it('supports text multibyte body', async () => {
    const method = 'POST';
    const body = 'こんにちは';
    const resp = await defaultCtx.request(`${server.origin}/inspect`, { method, body });
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(resp.headers['content-type'], 'application/json');
    const buf = await readStream(resp.readable);
    const json = JSON.parse(buf);
    assert(typeof json === 'object');
    assert.strictEqual(json.method, method);
    assert.strictEqual(json.headers['content-type'], 'text/plain; charset=utf-8');
    assert.strictEqual(+json.headers['content-length'], Buffer.from(body, 'utf-8').length);
    assert.strictEqual(json.body, body);
  });

  it('supports buffer body', async () => {
    const method = 'POST';
    const body = Buffer.from(new Uint8Array([0xfe, 0xff, 0x41]));
    const resp = await defaultCtx.request(`${server.origin}/inspect`, {
      method,
      body,
      headers: {
        'content-type': 'application/octet-stream',
      },
    });
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(resp.headers['content-type'], 'application/json');
    const buf = await readStream(resp.readable);
    const json = JSON.parse(buf);
    assert(typeof json === 'object');
    assert.strictEqual(json.method, method);
    assert.strictEqual(json.headers['content-type'], 'application/octet-stream');
    assert.strictEqual(+json.headers['content-length'], body.length);
    assert.deepStrictEqual(
      Buffer.from(json.base64Body, 'base64'),
      body,
    );
  });

  it('supports arrayBuffer body', async () => {
    const method = 'POST';
    const body = new Uint8Array([0xfe, 0xff, 0x41]).buffer; // ArrayBuffer instance
    const resp = await defaultCtx.request(`${server.origin}/inspect`, {
      method,
      body,
      headers: {
        'content-type': 'application/octet-stream',
      },
    });
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(resp.headers['content-type'], 'application/json');
    const buf = await readStream(resp.readable);
    const json = JSON.parse(buf);
    assert(typeof json === 'object');
    assert.strictEqual(json.method, method);
    assert.strictEqual(json.headers['content-type'], 'application/octet-stream');
    assert.strictEqual(+json.headers['content-length'], body.byteLength);
    assert.deepStrictEqual(
      Buffer.from(json.base64Body, 'base64'),
      Buffer.from(new Uint8Array(body)),
    );
  });

  it('supports text body (html)', async () => {
    const method = 'POST';
    const body = '<h1>Hello, World!</h1>';
    const contentType = 'text/html; charset=utf-8';
    const headers = { 'content-type': contentType };
    const resp = await defaultCtx.request(`${server.origin}/inspect`, { method, body, headers });
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(resp.headers['content-type'], 'application/json');
    const buf = await readStream(resp.readable);
    const json = JSON.parse(buf);
    assert(typeof json === 'object');
    assert.strictEqual(json.method, method);
    assert.strictEqual(json.headers['content-type'], contentType);
    assert.strictEqual(+json.headers['content-length'], body.length);
    assert.strictEqual(json.body, body);
  });

  it('supports stream body', async () => {
    const method = 'POST';
    const body = fs.createReadStream(__filename);
    const resp = await defaultCtx.request(`${server.origin}/inspect`, { method, body });
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(resp.headers['content-type'], 'application/json');
    const buf = await readStream(resp.readable);
    const json = JSON.parse(buf);
    assert(typeof json === 'object');
    assert.strictEqual(json.method, method);
    assert.strictEqual(json.headers['content-length'], undefined);
    assert.strictEqual(json.body, fs.readFileSync(__filename).toString());
  });

  it('coerces arbitrary body to string', async () => {
    const method = 'POST';
    const body = Number(313);
    const resp = await defaultCtx.request(`${server.origin}/inspect`, { method, body });
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(resp.headers['content-type'], 'application/json');
    const buf = await readStream(resp.readable);
    const json = JSON.parse(buf);
    assert(typeof json === 'object');
    assert.strictEqual(json.method, method);
    assert.strictEqual(+json.headers['content-length'], String(body).length);
    assert.strictEqual(json.body, String(body));
  });

  it('supports URLSearchParams body', async () => {
    const params = {
      name: 'André Citroën',
      rumple: 'stiltskin',
    };
    const method = 'POST';
    const body = new URLSearchParams(params);
    const resp = await defaultCtx.request(`${server.origin}/inspect`, { method, body });
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(resp.headers['content-type'], 'application/json');
    const buf = await readStream(resp.readable);
    const json = JSON.parse(buf);
    assert(typeof json === 'object');
    assert.strictEqual(json.method, method);
    assert.strictEqual(json.headers['content-type'], 'application/x-www-form-urlencoded; charset=utf-8');
    assert.strictEqual(+json.headers['content-length'], body.toString().length);
    assert.strictEqual(json.body, body.toString());
  });

  it('supports spec-compliant FormData body', async () => {
    const searchParams = {
      name: 'André Citroën',
      rumple: 'stiltskin',
    };
    const method = 'POST';
    const form = new FormData();
    Object.entries(searchParams).forEach(([k, v]) => form.append(k, v));

    const resp = await defaultCtx.request(`${server.origin}/inspect`, { method, body: form });
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(resp.headers['content-type'], 'application/json');
    const buf = await readStream(resp.readable);
    const json = JSON.parse(buf);
    assert(typeof json === 'object');
    assert.strictEqual(json.method, method);
    assert(json.headers['content-type'].startsWith('multipart/form-data; boundary='));
    const reqForm = parseMultiPartFormData(json.headers['content-type'], Buffer.from(json.base64Body, 'base64'));
    assert.deepStrictEqual(searchParams, reqForm);
  });

  it('supports POST without body', async () => {
    const method = 'POST';
    const resp = await defaultCtx.request(`${server.origin}/inspect`, { method });
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(resp.headers['content-type'], 'application/json');
    const buf = await readStream(resp.readable);
    const json = JSON.parse(buf);
    assert(typeof json === 'object');
    assert.strictEqual(json.method, method);
    assert.strictEqual(+json.headers['content-length'], 0);
  });

  it('supports gzip content encoding', async () => {
    const resp = await defaultCtx.request(`${server.origin}/gzip`);
    assert.strictEqual(resp.statusCode, 200);
    assert(resp.headers['content-type'].startsWith('text/plain'));
    assert.strictEqual(resp.headers['content-encoding'], 'gzip');
    const buf = await readStream(resp.readable);
    assert.strictEqual(buf.toString(), HELLO_WORLD);
  });

  it('supports deflate content encoding', async () => {
    const resp = await defaultCtx.request(`${server.origin}/deflate`);
    assert.strictEqual(resp.statusCode, 200);
    assert(resp.headers['content-type'].startsWith('text/plain'));
    assert.strictEqual(resp.headers['content-encoding'], 'deflate');
    const buf = await readStream(resp.readable);
    assert.strictEqual(buf.toString(), HELLO_WORLD);
  });

  it('supports brotli content encoding', async () => {
    const resp = await defaultCtx.request(`${server.origin}/brotli`);
    assert.strictEqual(resp.statusCode, 200);
    assert(resp.headers['content-type'].startsWith('text/plain'));
    assert.strictEqual(resp.headers['content-encoding'], 'br');
    const buf = await readStream(resp.readable);
    assert.strictEqual(buf.toString(), HELLO_WORLD);
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

  it('HTTP/2 server push can be rejected', async () => {
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
      const { url, response: pushedResp } = await pushedResource;
      assert.strictEqual(url, 'https://nghttp2.org/stylesheets/screen.css');
      assert.strictEqual(pushedResp.statusCode, 200);
      assert.strictEqual(pushedResp.headers['content-type'], 'text/css');
      // verify pushed response stream is ready to be consumed
      assert.strictEqual(pushedResp.readable.closed, false);
      // wait some time in order to trigger the timeout for idle pushed streams
      await sleep(250);
      // verify pushed response stream has been discarded (due to idle session timeout)
      assert.strictEqual(pushedResp.readable.closed, true);
    } finally {
      await customCtx.reset();
    }
  });

  it('supports timeout for idle HTTP/2 session', async () => {
    // automatically close idle session after 100ms
    const customCtx = context({ h2: { idleSessionTimeout: 100, rejectUnauthorized: false } });
    try {
      const resp = await customCtx.request(`${server.origin}/status/200`);
      assert.strictEqual(resp.statusCode, 200);
      assert.strictEqual(resp.httpVersionMajor, 2);
      // verify response stream is ready to be consumed
      assert.strictEqual(resp.readable.readable, true);
      // wait some time in order to trigger the timeout for idle session
      await sleep(150);
      // verify response stream has been discarded (due to idle session timeout)
      assert.strictEqual(resp.readable.readable, false);
    } finally {
      await customCtx.reset();
    }
  });
});
