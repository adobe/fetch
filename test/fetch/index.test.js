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
import stream from 'stream';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

import { FormData } from 'formdata-node';
import { WritableStreamBuffer } from 'stream-buffers';

import { isReadableStream, parseMultiPartFormData } from '../utils.js';
import Server from '../server.js';
import defaultFetchContext from '../../src/fetch/index.js';

// Workaround for ES6 which doesn't support the NodeJS global __filename
const __filename = fileURLToPath(import.meta.url);

const HELLO_WORLD = 'Hello, World!';

const {
  context,
  ALPN_HTTP1_1,
  ALPN_HTTP2,
  FetchError,
  AbortController: FetchAbortController,
  AbortError,
  timeoutSignal,
} = defaultFetchContext;

const testParams = [
  {
    name: 'http: (default: HTTP 1.1)',
    protocol: 'http',
    httpVersion: '1.1',
    context: defaultFetchContext,
  },
  {
    name: 'https: (default: ALPN)',
    protocol: 'https',
    httpVersion: '2.0',
    context: context({ rejectUnauthorized: false }),
  },
  {
    name: 'https: (forced: HTTP 1.1)',
    protocol: 'https',
    httpVersion: '1.1',
    context: context({ alpnProtocols: [ALPN_HTTP1_1], h1: { rejectUnauthorized: false } }),
  },
  {
    name: 'https: (forced: HTTP 2.0)',
    protocol: 'https',
    httpVersion: '2.0',
    context: context({ alpnProtocols: [ALPN_HTTP2], h2: { rejectUnauthorized: false } }),
  },
];

testParams.forEach((params) => {
  const {
    name,
    protocol,
    httpVersion,
    context: {
      fetch,
      reset,
    },
  } = params;

  describe(`Fetch Tests: ${name}`, () => {
    let server;

    before(async () => {
      server = await Server.launch(httpVersion === '2.0' ? 2 : 1, protocol === 'https', HELLO_WORLD);
    });

    after(async () => {
      await reset();
      try {
        process.kill(server.pid);
      } catch (ignore) { /* ignore */ }
    });

    it('rejects on non-string method option', async () => {
      await assert.rejects(() => fetch(`${server.origin}/status/200`, { method: true }));
    });

    it('return ok for 2xx status codes', async () => {
      const resp = await fetch(`${server.origin}/status/204`);
      assert.strictEqual(resp.status, 204);
      assert.strictEqual(resp.ok, true);
      assert.strictEqual(resp.httpVersion, httpVersion);
    });

    it('returns !ok non-2xx status codes', async () => {
      const resp = await fetch(`${server.origin}/status/500`);
      assert.strictEqual(resp.status, 500);
      assert.strictEqual(resp.ok, false);
      assert.strictEqual(resp.httpVersion, httpVersion);
    });

    it('supports json response body', async () => {
      const resp = await fetch(`${server.origin}/inspect`);
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.httpVersion, httpVersion);
      assert.strictEqual(resp.headers.get('content-type'), 'application/json');
      const json = await resp.json();
      assert(json !== null && typeof json === 'object');
    });

    it('supports binary response body (ArrayBuffer)', async () => {
      const dataLen = 100 * 1024;
      const contentType = 'application/octet-stream';
      const resp = await fetch(`${server.origin}/stream-bytes?count=${dataLen}`, {
        headers: { accept: contentType },
      });
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.httpVersion, httpVersion);
      assert.strictEqual(resp.headers.get('content-type'), contentType);
      const buffer = await resp.arrayBuffer();
      assert(buffer instanceof ArrayBuffer);
      assert.strictEqual(buffer.byteLength, dataLen);
    });

    it('supports binary response body (Stream)', async () => {
      const dataLen = 100 * 1024;
      const contentType = 'application/octet-stream';
      const resp = await fetch(`${server.origin}/stream-bytes?count=${dataLen}`, {
        headers: { accept: contentType },
      });
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.httpVersion, httpVersion);
      assert.strictEqual(resp.headers.get('content-type'), contentType);
      const imageStream = resp.body;
      assert(isReadableStream(imageStream));

      const finished = promisify(stream.finished);
      const out = new WritableStreamBuffer();
      imageStream.pipe(out);
      await finished(out);
      assert.strictEqual(out.getContents().length, dataLen);
    });

    it('supports json POST', async () => {
      const method = 'POST';
      const body = { foo: 'bar' };
      const resp = await fetch(`${server.origin}/inspect`, { method, body });
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.httpVersion, httpVersion);
      assert.strictEqual(resp.headers.get('content-type'), 'application/json');
      const json = await resp.json();
      assert(json !== null && typeof json === 'object');
      assert.strictEqual(json.method, method);
      assert.strictEqual(json.headers['content-type'], 'application/json');
      assert.strictEqual(+json.headers['content-length'], JSON.stringify(body).length);
      assert.deepStrictEqual(JSON.parse(json.body), body);
    });

    it('supports json PATCH', async () => {
      const method = 'PATCH';
      const body = { foo: 'bar' };
      const resp = await fetch(`${server.origin}/inspect`, { method, body });
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.httpVersion, httpVersion);
      assert.strictEqual(resp.headers.get('content-type'), 'application/json');
      const json = await resp.json();
      assert(json !== null && typeof json === 'object');
      assert.strictEqual(json.method, method);
      assert.strictEqual(json.headers['content-type'], 'application/json');
      assert.strictEqual(+json.headers['content-length'], JSON.stringify(body).length);
      assert.deepStrictEqual(JSON.parse(json.body), body);
    });

    it('sanitizes lowercase method names', async () => {
      const method = 'post';
      const body = { foo: 'bar' };
      const resp = await fetch(`${server.origin}/inspect`, { method, body });
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.httpVersion, httpVersion);
      assert.strictEqual(resp.headers.get('content-type'), 'application/json');
      const json = await resp.json();
      assert(json !== null && typeof json === 'object');
      assert.strictEqual(json.method, method.toUpperCase());
      assert.strictEqual(json.headers['content-type'], 'application/json');
      assert.strictEqual(+json.headers['content-length'], JSON.stringify(body).length);
      assert.deepStrictEqual(JSON.parse(json.body), body);
    });

    it('AbortController works (premature abort)', async () => {
      const controller = new FetchAbortController();
      controller.abort();
      const { signal } = controller;
      // make sure signal has fired
      assert(signal.aborted);

      const method = 'POST';
      const body = stream.Readable.from('Hello, World!');

      const ts0 = Date.now();
      try {
        await fetch(`${server.origin}/status/200`, { signal, method, body });
        assert.fail();
      } catch (err) {
        assert(err instanceof AbortError);
      }
      const ts1 = Date.now();
      assert((ts1 - ts0) < 10);
      // make sure request body (stream) is destroyed
      assert(body.destroyed);
    });

    it('built-in AbortController works (premature abort)', async () => {
      const controller = new AbortController();
      controller.abort();
      const { signal } = controller;
      // make sure signal has fired
      assert(signal.aborted);

      const method = 'POST';
      const body = stream.Readable.from('Hello, World!');

      const ts0 = Date.now();
      try {
        await fetch(`${server.origin}/status/200`, { signal, method, body });
        assert.fail();
      } catch (err) {
        assert(err instanceof AbortError);
      }
      const ts1 = Date.now();
      assert((ts1 - ts0) < 10);
      // make sure request body (stream) is destroyed
      assert(body.destroyed);
    });

    it('timeoutSignal works (slow response)', async () => {
      const signal = timeoutSignal(500);

      const method = 'POST';
      const body = stream.Readable.from('Hello, World!');

      const ts0 = Date.now();
      try {
        // the server responds with a 2 second delay, fetch is aborted after 0.5 seconds.
        await fetch(`${server.origin}/hello?delay=2000`, { signal, method, body });
        assert.fail();
      } catch (err) {
        assert(err instanceof AbortError);
      }
      const ts1 = Date.now();
      assert((ts1 - ts0) < 500 * 1.05);
      // make sure request body (stream) is destroyed
      assert(body.destroyed);
    });

    it('AbortController works (slow response)', async () => {
      const controller = new FetchAbortController();
      setTimeout(() => controller.abort(), 1000);
      const { signal } = controller;

      const method = 'POST';
      const body = stream.Readable.from('Hello, World!');

      const ts0 = Date.now();
      try {
        // the server responds with a 2 second delay, fetch is aborted after 1 second.
        await fetch(`${server.origin}/hello?delay=2000`, { signal, method, body });
        assert.fail();
      } catch (err) {
        assert(err instanceof AbortError);
      }
      const ts1 = Date.now();
      assert((ts1 - ts0) < 1000 * 1.1);
      // make sure request body (stream) is destroyed
      assert(body.destroyed);
    });

    it('built-in AbortController works (slow response)', async () => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 1000);
      const { signal } = controller;

      const method = 'POST';
      const body = stream.Readable.from('Hello, World!');

      const ts0 = Date.now();
      try {
        // the server responds with a 2 second delay, fetch is aborted after 1 second.
        await fetch(`${server.origin}/hello?delay=2000`, { signal, method, body });
        assert.fail();
      } catch (err) {
        assert(err instanceof AbortError);
      }
      const ts1 = Date.now();
      assert((ts1 - ts0) < 1000 * 1.1);
      // make sure request body (stream) is destroyed
      assert(body.destroyed);
    });

    it('AbortController works (POST with string body)', async () => {
      const controller = new FetchAbortController();
      setTimeout(() => controller.abort(), 1);
      const { signal } = controller;

      const method = 'POST';
      const body = 'Hello, World!';

      try {
        await fetch(`${server.origin}/inspect`, { signal, method, body });
        assert.fail();
      } catch (err) {
        assert(err instanceof AbortError);
      }
    });

    it('built-in AbortController works (POST with string body)', async () => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 1);
      const { signal } = controller;

      const method = 'POST';
      const body = 'Hello, World!';

      try {
        await fetch(`${server.origin}/inspect`, { signal, method, body });
        assert.fail();
      } catch (err) {
        if (!(err instanceof AbortError)) {
          // eslint-disable-next-line no-console
          console.error(err);
        }
        assert(err instanceof AbortError);
      }
    });

    it('AbortController works (dripping response)', async () => {
      const FETCH_TIMEOUT = 1000; // ms
      const DRIPPING_DURATION = 2; // seconds
      const TEST_URL = `${protocol}://httpbingo.org/drip?duration=${DRIPPING_DURATION}&numbytes=10&code=200&delay=0`;

      const controller = new FetchAbortController();
      setTimeout(() => controller.abort(), FETCH_TIMEOUT);
      const { signal } = controller;

      const method = 'POST';
      const body = stream.Readable.from('Hello, World!');

      const ts0 = Date.now();
      try {
        const res = await fetch(TEST_URL, { signal, method, body });
        await res.buffer();
        assert.fail();
      } catch (err) {
        assert(err instanceof AbortError);
      }
      const ts1 = Date.now();
      assert((ts1 - ts0) < FETCH_TIMEOUT * 1.1);
      // make sure request body (stream) is destroyed
      assert(body.destroyed);
    });

    it('built-in AbortController works (dripping response)', async () => {
      const FETCH_TIMEOUT = 1000; // ms
      const DRIPPING_DURATION = 2; // seconds
      const TEST_URL = `${protocol}://httpbingo.org/drip?duration=${DRIPPING_DURATION}&numbytes=10&code=200&delay=0`;

      const controller = new AbortController();
      setTimeout(() => controller.abort(), FETCH_TIMEOUT);
      const { signal } = controller;

      const method = 'POST';
      const body = stream.Readable.from('Hello, World!');

      const ts0 = Date.now();
      try {
        const res = await fetch(TEST_URL, { signal, method, body });
        await res.buffer();
        assert.fail();
      } catch (err) {
        assert(err instanceof AbortError);
      }
      const ts1 = Date.now();
      assert((ts1 - ts0) < FETCH_TIMEOUT * 1.1);
      // make sure request body (stream) is destroyed
      assert(body.destroyed);
    });

    it('AbortController works (slow connect)', async () => {
      const controller = new FetchAbortController();
      setTimeout(() => controller.abort(), 1000);
      const { signal } = controller;

      const ts0 = Date.now();
      try {
        // the TLS connect to the server hangs, fetch is aborted after 1 second.
        await fetch(`${protocol}://http-me.glitch.me:81/`, { signal });
        assert.fail();
      } catch (err) {
        assert(err instanceof AbortError);
      }
      const ts1 = Date.now();
      assert((ts1 - ts0) < 1000 * 1.1);
    });

    it('built-in AbortController works (slow connect)', async () => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 1000);
      const { signal } = controller;

      const ts0 = Date.now();
      try {
        // the TLS connect to the server hangs, fetch is aborted after 1 second.
        await fetch(`${protocol}://http-me.glitch.me:81/`, { signal });
        assert.fail();
      } catch (err) {
        assert(err instanceof AbortError);
      }
      const ts1 = Date.now();
      assert((ts1 - ts0) < 1000 * 1.1);
    });

    it('custom user-agent works', async () => {
      const customUserAgent = 'custom-fetch';
      const ctx = context({
        userAgent: customUserAgent,
        rejectUnauthorized: false,
      });
      const resp = await ctx.fetch(`${server.origin}/inspect`);
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.headers.get('content-type'), 'application/json');
      const json = await resp.json();
      assert.strictEqual(json.headers['user-agent'], customUserAgent);
      await ctx.reset();
    });

    it('creating custom fetch context works', async () => {
      const ctx = context({ rejectUnauthorized: false });
      const resp = await ctx.fetch(`${server.origin}/status/200`);
      assert.strictEqual(resp.status, 200);
      await ctx.reset();
    });

    it('headers.plain() works', async () => {
      const resp = await fetch(`${server.origin}/inspect`, {
        method: 'PUT',
        body: JSON.stringify({ foo: 'bar' }),
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
      });
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.httpVersion, httpVersion);
      assert.strictEqual(resp.headers.plain()['content-type'], 'application/json');
      const json = await resp.json();
      assert(json !== null && typeof json === 'object');
    });

    it('can override host header', async () => {
      const host = 'foobar.com';
      const resp = await fetch(`${server.origin}/inspect`, { headers: { host } });
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.httpVersion, httpVersion);
      assert.strictEqual(resp.headers.get('content-type'), 'application/json');
      const json = await resp.json();
      assert.strictEqual(json.headers.host, host);
    });

    it('supports redirect (default)', async () => {
      const location = `${server.origin}/status/200`;
      const url = `${server.origin}/redirect-to?url=${encodeURIComponent(location)}&status_code=307`;
      let resp = await fetch(url, { cache: 'no-store' });
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.redirected, true);
      // same with a signal (code coverage)
      const controller = new AbortController();
      const { signal } = controller;
      resp = await fetch(url, { cache: 'no-store', signal });
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.redirected, true);
    });

    it('supports redirect: follow', async () => {
      const location = `${server.origin}/status/200`;
      const url = `${server.origin}/redirect-to?url=${encodeURIComponent(location)}&status_code=307`;
      const resp = await fetch(url, { redirect: 'follow', cache: 'no-store' });
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.redirected, true);
    });

    it('supports redirect: manual', async () => {
      const location = `${server.origin}/status/200`;
      const resp = await fetch(
        `${server.origin}/redirect-to?url=${encodeURIComponent(location)}&status_code=307`,
        { redirect: 'manual', cache: 'no-store' },
      );
      assert.strictEqual(resp.status, 307);
      assert.strictEqual(resp.headers.get('location'), location);
      assert.strictEqual(resp.redirected, false);
    });

    it('supports redirect: manual with path location', async () => {
      const location = '/redirect/here';
      const resp = await fetch(
        `${server.origin}/redirect-to?url=${encodeURIComponent(location)}&status_code=307`,
        { redirect: 'manual', cache: 'no-store' },
      );
      assert.strictEqual(resp.status, 307);
      assert.strictEqual(resp.headers.get('location'), location);
      assert.strictEqual(resp.redirected, false);
    });

    it('supports follow option (max-redirect limit)', async () => {
      // 5 redirects, follows: 4
      await assert.rejects(() => fetch(`${server.origin}/redirect/5`, { follow: 4 }), FetchError);
    });

    it('supports follow: 0', async () => {
      const location = `${server.origin}/status/200`;
      await assert.rejects(() => fetch(
        `${server.origin}/redirect-to?url=${encodeURIComponent(location)}&status_code=307`,
        { follow: 0 },
      ), FetchError);
      // same with a signal (code coverage)
      const controller = new AbortController();
      const { signal } = controller;
      await assert.rejects(() => fetch(
        `${server.origin}/redirect-to?url=${encodeURIComponent(location)}&status_code=307`,
        { follow: 0, signal },
      ), FetchError);
    });

    it('rejects redirect with non-http location', async () => {
      const location = 'ftp://acme.com/foo';
      await assert.rejects(() => fetch(
        `${server.origin}/redirect-to?url=${encodeURIComponent(location)}&status_code=307`,
      ), FetchError);
    });

    it('does not strip Authorization header when redirecting to same origin', async () => {
      const location = `${server.origin}/inspect`;
      const authorization = 'Bearer foo';
      const resp = await fetch(`${server.origin}/redirect-to?url=${encodeURIComponent(location)}&status_code=307`, {
        cache: 'no-store',
        headers: { authorization },
      });
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.redirected, true);
      assert.strictEqual(resp.headers.get('content-type'), 'application/json');
      const json = await resp.json();
      assert(json !== null && typeof json === 'object');
      assert.strictEqual(json.headers.authorization, authorization);
    });

    it('strips Authorization header when redirecting to different origin', async () => {
      const targetServer = await Server.launch(1, false);
      try {
        const location = `${targetServer.origin}/inspect`;
        const resp = await fetch(`${server.origin}/redirect-to?url=${encodeURIComponent(location)}&status_code=307`, {
          cache: 'no-store',
          headers: {
            authorization: 'Bearer test',
          },
        });
        assert.strictEqual(resp.status, 200);
        assert.strictEqual(resp.redirected, true);
        assert.strictEqual(resp.headers.get('content-type'), 'application/json');
        const json = await resp.json();
        assert(json !== null && typeof json === 'object');
        assert.strictEqual(json.headers.authorization, undefined);
      } finally {
        try {
          process.kill(targetServer.pid);
        } catch (ignore) { /* ignore */ }
      }
    });

    it('supports redirect: error', async () => {
      const location = `${server.origin}/status/200`;
      await assert.rejects(() => fetch(
        `${server.origin}/redirect-to?url=${encodeURIComponent(location)}&status_code=307`,
        { redirect: 'error' },
      ), FetchError);
      // same with a signal (code coverage)
      const controller = new AbortController();
      const { signal } = controller;
      await assert.rejects(() => fetch(
        `${server.origin}/redirect-to?url=${encodeURIComponent(location)}&status_code=307`,
        { redirect: 'error', signal },
      ), FetchError);
    });

    it('supports multiple redirects', async () => {
      const resp = await fetch(`${server.origin}/redirect/5`, { cache: 'no-store' });
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.redirected, true);
    });

    it('supports redirect without location header', async () => {
      const resp = await fetch(`${server.origin}/status/308`, { cache: 'no-store' });
      assert.strictEqual(resp.status, 308);
      assert.strictEqual(resp.redirected, false);
      assert(!resp.headers.has('location'));
    });

    it('follows redirect code 303 with GET', async () => {
      const location = '/inspect';
      const url = `${server.origin}/redirect-to?url=${encodeURIComponent(location)}&status_code=303`;
      const method = 'POST';
      const body = 'foo bar';
      const resp = await fetch(url, { method, body, cache: 'no-store' });
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.httpVersion, httpVersion);
      assert.strictEqual(resp.redirected, true);
      assert.strictEqual(resp.headers.get('content-type'), 'application/json');
      const json = await resp.json();
      assert(json !== null && typeof json === 'object');
      assert.strictEqual(json.body, '');
      assert.strictEqual(json.method, 'GET');
      assert.strictEqual(json.headers['content-type'], undefined);
      assert.strictEqual(json.headers['content-length'], undefined);
    });

    it('follows redirected POST with json body', async () => {
      const location = '/inspect';
      const url = `${server.origin}/redirect-to?url=${encodeURIComponent(location)}&status_code=307`;
      const method = 'POST';
      const body = { foo: 'bar' };
      const resp = await fetch(url, { method, body, cache: 'no-store' });
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.redirected, true);
      assert.strictEqual(resp.headers.get('content-type'), 'application/json');
      const json = await resp.json();
      assert(json !== null && typeof json === 'object');
      assert.deepStrictEqual(JSON.parse(json.body), body);
      assert.strictEqual(json.method, 'POST');
    });

    it('supports gzip/deflate/br content decoding (default)', async () => {
      const resp = await fetch(`${protocol}://www.aem.live/`, { cache: 'no-store' });
      assert.strictEqual(resp.status, 200);
      // assert.strictEqual(resp.httpVersion, httpVersion);
      assert.match(resp.headers.get('content-encoding'), /^gzip|br$/);
      const body = await resp.text();
      assert(body.startsWith('<!DOCTYPE html>'));
      assert(+resp.headers.get('content-length') < body.length);
      assert.strictEqual(resp.decoded, true);
    });

    it('supports disabling gzip/deflate/br content decoding', async () => {
      const resp = await fetch(`${protocol}://www.aem.live/`, { decode: false, cache: 'no-store' });
      assert.strictEqual(resp.status, 200);
      // assert.strictEqual(resp.httpVersion, httpVersion);
      assert.match(resp.headers.get('content-encoding'), /^gzip|br$/);
      const body = await resp.arrayBuffer();
      assert.strictEqual(+resp.headers.get('content-length'), body.byteLength);
      assert.strictEqual(resp.decoded, false);
    });

    it('fails non-GET redirect if body is a readable stream', async () => {
      const method = 'POST';
      const body = stream.Readable.from('foo bar');
      const location = `${server.origin}/status/200`;
      await assert.rejects(() => fetch(
        `${server.origin}/redirect-to?url=${encodeURIComponent(location)}&status_code=307`,
        { method, body },
      ), FetchError);
      // same with a signal (code coverage)
      const controller = new AbortController();
      const { signal } = controller;
      await assert.rejects(() => fetch(
        `${server.origin}/redirect-to?url=${encodeURIComponent(location)}&status_code=307`,
        { method, body, signal },
      ), FetchError);
    });

    it('supports text body', async () => {
      const method = 'POST';
      const body = 'Hello, World!';
      const resp = await fetch(`${server.origin}/inspect`, { method, body });
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.httpVersion, httpVersion);
      assert.strictEqual(resp.headers.get('content-type'), 'application/json');
      const json = await resp.json();
      assert(json !== null && typeof json === 'object');
      assert.strictEqual(+json.headers['content-length'], body.length);
      assert.strictEqual(json.headers['content-type'], 'text/plain; charset=utf-8');
      assert.strictEqual(json.body, body);
    });

    it('supports stream body', async () => {
      const method = 'POST';
      const body = fs.createReadStream(__filename);
      const resp = await fetch(`${server.origin}/inspect`, { method, body });
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.httpVersion, httpVersion);
      assert.strictEqual(resp.headers.get('content-type'), 'application/json');
      const json = await resp.json();
      assert(json !== null && typeof json === 'object');
      assert.strictEqual(json.body, fs.readFileSync(__filename).toString());
      assert.strictEqual(json.headers['content-length'], undefined);
    });

    it('supports URLSearchParams body', async () => {
      const searchParams = {
        name: 'André Citroën',
        rumple: 'stiltskin',
      };
      const method = 'POST';
      const body = new URLSearchParams(searchParams);
      const resp = await fetch(`${server.origin}/inspect`, { method, body });
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.httpVersion, httpVersion);
      assert.strictEqual(resp.headers.get('content-type'), 'application/json');
      const json = await resp.json();
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

      const resp = await fetch(`${server.origin}/inspect`, { method, body: form });
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.httpVersion, httpVersion);
      assert.strictEqual(resp.headers.get('content-type'), 'application/json');
      const json = await resp.json();
      assert(typeof json === 'object');
      assert.strictEqual(json.method, method);
      assert(json.headers['content-type'].startsWith('multipart/form-data; boundary='));
      const reqForm = parseMultiPartFormData(json.headers['content-type'], Buffer.from(json.base64Body, 'base64'));
      assert.deepStrictEqual(searchParams, reqForm);
    });

    it('returns Set-Cookie headers', async () => {
      const resp = await fetch(`${server.origin}/cookies/set?a=1&b=2`);
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.headers.get('set-cookie'), 'a=1, b=2');
      assert.strictEqual(resp.headers.raw()['set-cookie'][0], 'a=1');
      assert.strictEqual(resp.headers.raw()['set-cookie'][1], 'b=2');
    });

    if (protocol === 'https') {
      it('supports self signed certificate', async () => {
        // self signed certificates are rejected by default
        await assert.rejects(() => defaultFetchContext.fetch(`${server.origin}/hello`, { cache: 'no-store' }));

        const ctx = context({ rejectUnauthorized: false });
        try {
          let resp = await ctx.fetch(`${server.origin}/hello`, { cache: 'no-store' });
          assert.strictEqual(resp.status, 200);
          assert.strictEqual(resp.httpVersion, httpVersion);
          let body = await resp.text();
          assert.strictEqual(body, HELLO_WORLD);

          // try again
          resp = await ctx.fetch(`${server.origin}/hello`, { cache: 'no-store' });
          assert.strictEqual(resp.status, 200);
          assert.strictEqual(resp.httpVersion, httpVersion);
          body = await resp.text();
          assert.strictEqual(body, HELLO_WORLD);
        } finally {
          await ctx.reset();
          try {
            process.kill(server.pid);
          } catch (ignore) { /* ignore */ }
        }
      });
    }
  });
});
