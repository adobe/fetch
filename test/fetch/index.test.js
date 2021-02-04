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
const stream = require('stream');
const { promisify } = require('util');

const isStream = require('is-stream');
const { WritableStreamBuffer } = require('stream-buffers');

const defaultFetchContext = require('../../src/fetch');

const {
  context,
  ALPN_HTTP1_1,
  ALPN_HTTP2,
  FormData,
  FetchError,
  AbortController,
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
    context: defaultFetchContext,
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
  const baseUrl = `${protocol}://${httpVersion === '2.0' ? 'www.nghttp2.org/httpbin' : 'httpbin.org'}`;

  describe(`Fetch Tests: ${name}`, () => {
    after(async () => {
      await reset();
    });

    it('rejects on non-string method option', async () => {
      assert.rejects(() => fetch(`${baseUrl}/status/200`, { method: true }));
    });

    it('return ok for 2xx status codes', async () => {
      const resp = await fetch(`${baseUrl}/status/204`);
      assert.strictEqual(resp.status, 204);
      assert.strictEqual(resp.ok, true);
      assert.strictEqual(resp.httpVersion, httpVersion);
    });

    it('returns !ok non-2xx status codes', async () => {
      const resp = await fetch(`${baseUrl}/status/500`);
      assert.strictEqual(resp.status, 500);
      assert.strictEqual(resp.ok, false);
      assert.strictEqual(resp.httpVersion, httpVersion);
    });

    it('supports json response body', async () => {
      const resp = await fetch(`${baseUrl}/json`);
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.httpVersion, httpVersion);
      assert.strictEqual(resp.headers.get('content-type'), 'application/json');
      const json = await resp.json();
      assert(json !== null && typeof json === 'object');
    });

    it('supports binary response body (ArrayBuffer)', async () => {
      const dataLen = 64 * 1024; // httpbin.org/stream-bytes/{n} has a limit of 100kb ...
      const contentType = 'application/octet-stream';
      const resp = await fetch(`${baseUrl}/stream-bytes/${dataLen}`, {
        headers: { accept: contentType },
      });
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.httpVersion, httpVersion);
      assert.strictEqual(resp.headers.get('content-type'), contentType);
      const buffer = await resp.arrayBuffer();
      assert(buffer !== null && buffer instanceof ArrayBuffer);
      assert.strictEqual(buffer.byteLength, dataLen);
    });

    it('supports binary response body (Stream)', async () => {
      const dataLen = 64 * 1024; // httpbin.org/stream-bytes/{n} has a limit of 100kb ...
      const contentType = 'application/octet-stream';
      const resp = await fetch(`${baseUrl}/stream-bytes/${dataLen}`, {
        headers: { accept: contentType },
      });
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.httpVersion, httpVersion);
      assert.strictEqual(resp.headers.get('content-type'), contentType);
      const imageStream = resp.body;
      assert(isStream.readable(imageStream));

      const finished = promisify(stream.finished);
      const out = new WritableStreamBuffer();
      imageStream.pipe(out);
      await finished(out);
      assert.strictEqual(out.getContents().length, dataLen);
    });

    it('supports json POST', async () => {
      const method = 'POST';
      const body = { foo: 'bar' };
      const resp = await fetch(`${baseUrl}/post`, { method, body });
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.httpVersion, httpVersion);
      assert.strictEqual(resp.headers.get('content-type'), 'application/json');
      const jsonResponseBody = await resp.json();
      assert(jsonResponseBody !== null && typeof jsonResponseBody === 'object');
      assert.deepStrictEqual(jsonResponseBody.json, body);
    });

    it('supports json PATCH', async () => {
      const method = 'PATCH';
      const body = { foo: 'bar' };
      const resp = await fetch(`${baseUrl}/patch`, { method, body });
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.httpVersion, httpVersion);
      assert.strictEqual(resp.headers.get('content-type'), 'application/json');
      const jsonResponseBody = await resp.json();
      assert(jsonResponseBody !== null && typeof jsonResponseBody === 'object');
      assert.deepStrictEqual(jsonResponseBody.json, body);
    });

    it('sanitizes lowercase method names', async () => {
      const method = 'post';
      const body = { foo: 'bar' };
      const resp = await fetch(`${baseUrl}/post`, { method, body });
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.httpVersion, httpVersion);
      assert.strictEqual(resp.headers.get('content-type'), 'application/json');
      const jsonResponseBody = await resp.json();
      assert(jsonResponseBody !== null && typeof jsonResponseBody === 'object');
      assert.deepStrictEqual(jsonResponseBody.json, body);
    });

    it('AbortController works (premature abort)', async () => {
      const controller = new AbortController();
      controller.abort();
      const { signal } = controller;
      // make sure signal has fired
      assert(signal.aborted);

      const method = 'POST';
      const body = stream.Readable.from('hello, world!');

      const ts0 = Date.now();
      try {
        await fetch(`${baseUrl}/status/200`, { signal, method, body });
        assert.fail();
      } catch (err) {
        assert(err instanceof AbortError);
      }
      const ts1 = Date.now();
      assert((ts1 - ts0) < 10);
      // make sure request body (stream) is destroyed
      assert(body.destroyed);
    });

    it('timeoutSignal works (slow response)', async function test() {
      this.timeout(5000);

      const signal = timeoutSignal(500);

      const method = 'POST';
      const body = stream.Readable.from('hello, world!');

      const ts0 = Date.now();
      try {
        // the server responds with a 2 second delay, fetch is aborted after 0.5 seconds.
        await fetch(`${baseUrl}/delay/2`, { signal, method, body });
        assert.fail();
      } catch (err) {
        assert(err instanceof AbortError);
      }
      const ts1 = Date.now();
      assert((ts1 - ts0) < 500 * 1.05);
      // make sure request body (stream) is destroyed
      assert(body.destroyed);
    });

    it('AbortController works (slow response)', async function test() {
      this.timeout(5000);

      const controller = new AbortController();
      setTimeout(() => controller.abort(), 1000);
      const { signal } = controller;

      const method = 'POST';
      const body = stream.Readable.from('hello, world!');

      const ts0 = Date.now();
      try {
        // the server responds with a 2 second delay, fetch is aborted after 1 second.
        await fetch(`${baseUrl}/delay/2`, { signal, method, body });
        assert.fail();
      } catch (err) {
        assert(err instanceof AbortError);
      }
      const ts1 = Date.now();
      assert((ts1 - ts0) < 1000 * 1.1);
      // make sure request body (stream) is destroyed
      assert(body.destroyed);
    });

    it('AbortController works (dripping response)', async function test() {
      this.timeout(5000);

      const FETCH_TIMEOUT = 1000; // ms
      const DRIPPING_DURATION = 2; // seconds
      // doesn't support POST method
      // const TEST_URL =
      //  `${baseUrl}/drip?duration=${DRIPPING_DURATION}&numbytes=10&code=200&delay=0`;
      const TEST_URL = `${protocol}://httpbingo.org/drip?duration=${DRIPPING_DURATION}&numbytes=10&code=200&delay=0`;

      const controller = new AbortController();
      setTimeout(() => controller.abort(), FETCH_TIMEOUT);
      const { signal } = controller;

      const method = 'POST';
      const body = stream.Readable.from('hello, world!');

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
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 1000);
      const { signal } = controller;

      const ts0 = Date.now();
      try {
        // the TLS connect to the server hangs, fetch is aborted after 1 second.
        await fetch(`${protocol}://example.com:81/`, { signal });
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
      });
      const resp = await ctx.fetch(`${baseUrl}/user-agent`);
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.headers.get('content-type'), 'application/json');
      const json = await resp.json();
      assert.strictEqual(json['user-agent'], customUserAgent);
      await ctx.reset();
    });

    it('creating custom fetch context works', async () => {
      const ctx = context();
      const resp = await ctx.fetch(`${baseUrl}/status/200`);
      assert.strictEqual(resp.status, 200);
      await ctx.reset();
    });

    it('headers.plain() works', async () => {
      const resp = await fetch(`${baseUrl}/put`, {
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
      const resp = await fetch(`${baseUrl}/headers`, { headers: { host } });
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.httpVersion, httpVersion);
      assert.strictEqual(resp.headers.get('content-type'), 'application/json');
      const json = await resp.json();
      let hostHeaderValue;
      Object.keys(json.headers || {}).forEach((nm) => {
        if (nm.toLowerCase() === 'host') {
          hostHeaderValue = json.headers[nm];
        }
      });
      assert.strictEqual(hostHeaderValue, host);
    });

    it('supports redirect (default)', async () => {
      const url = `${protocol}://httpbingo.org/redirect-to?url=${protocol}%3A%2F%2Fhttpbin.org%2Fstatus%2F200&status_code=307`;
      // const url = `${protocol}://httpstat.us/307`; // sometimes very slooow/unreliable
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
      const url = `${protocol}://httpbingo.org/redirect-to?url=${protocol}%3A%2F%2Fhttpbin.org%2Fstatus%2F200&status_code=307`;
      // const url = `${protocol}://httpstat.us/307`; // sometimes very slooow/unreliable
      const resp = await fetch(url, { redirect: 'follow', cache: 'no-store' });
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.redirected, true);
    });

    it('supports redirect: manual', async () => {
      const resp = await fetch(
        // `${protocol}://httpstat.us/307`, // unreliable server (frequent 503s)
        `${protocol}://httpbin.org/status/307`,
        { redirect: 'manual', cache: 'no-store' },
      );
      assert.strictEqual(resp.status, 307);
      assert.strictEqual(
        resp.headers.get('location'),
        // 'https://httpstat.us/',
        '/redirect/1',
      );
      assert.strictEqual(resp.redirected, false);
    });

    it('supports follow option (max-redirect limit)', async () => {
      // 5 relative redirects, follows: 4
      assert.rejects(() => fetch(`${protocol}://httpbingo.org/relative-redirect/5`, { follow: 4 }), FetchError);
    });

    it('supports follow: 0', async () => {
      assert.rejects(() => fetch(
        // `${protocol}://httpstat.us/307`, // unreliable server (frequent 503s)
        `${protocol}://httpbin.org/status/307`,
        { follow: 0 },
      ), FetchError);
      // same with a signal (code coverage)
      const controller = new AbortController();
      const { signal } = controller;
      assert.rejects(() => fetch(
        // `${protocol}://httpstat.us/307`, // unreliable server (frequent 503s)
        `${protocol}://httpbin.org/status/307`,
        { follow: 0, signal },
      ), FetchError);
    });

    it('supports redirect: error', async () => {
      assert.rejects(() => fetch(
        // `${protocol}://httpstat.us/307`, // unreliable server (frequent 503s)
        `${protocol}://httpbin.org/status/307`,
        { redirect: 'error' },
      ), FetchError);
      // same with a signal (code coverage)
      const controller = new AbortController();
      const { signal } = controller;
      assert.rejects(() => fetch(
        // `${protocol}://httpstat.us/307`, // unreliable server (frequent 503s)
        `${protocol}://httpbin.org/status/307`,
        { redirect: 'error', signal },
      ), FetchError);
    });

    it('supports multiple redirects', async () => {
      const resp = await fetch(`${protocol}://httpbingo.org/relative-redirect/5`, { cache: 'no-store' });
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.redirected, true);
    });

    it('supports redirect without location header', async () => {
      const resp = await fetch(`${baseUrl}/status/308`, { cache: 'no-store' });
      assert.strictEqual(resp.status, 308);
      assert.strictEqual(resp.redirected, false);
    });

    it('follows redirect code 303 with GET', async () => {
      const url = `${protocol}://httpbingo.org/redirect-to?url=${protocol}%3A%2F%2Fhttpbin.org%2Fanything&status_code=303`;
      const method = 'POST';
      const body = 'foo bar';
      const resp = await fetch(url, { method, body, cache: 'no-store' });
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.httpVersion, httpVersion);
      assert.strictEqual(resp.redirected, true);
      assert.strictEqual(resp.headers.get('content-type'), 'application/json');
      const jsonResponseBody = await resp.json();
      assert(jsonResponseBody !== null && typeof jsonResponseBody === 'object');
      assert.strictEqual(jsonResponseBody.method, 'GET');
      assert.strictEqual(jsonResponseBody.data, '');
    });

    it('follows redirected POST with json body', async () => {
      const method = 'POST';
      const body = { foo: 'bar' };
      const url = `${protocol}://httpbingo.org/redirect-to?url=${protocol}%3A%2F%2Fhttpbin.org%2Fstatus%2F200&status_code=307`;
      // const url = `${protocol}://httpstat.us/307`; // sometimes very slooow
      const resp = await fetch(url, { method, body, cache: 'no-store' });
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.redirected, true);
    });

    it('fails non-GET redirect if body is a readable stream', async () => {
      const method = 'POST';
      const body = stream.Readable.from('foo bar');
      assert.rejects(() => fetch(
        // `${protocol}://httpstat.us/307`, // unreliable server (frequent 503s)
        `${protocol}://httpbin.org/status/307`,
        { method, body },
      ), FetchError);
      assert(!body.destroyed);
      // same with a signal (code coverage)
      const controller = new AbortController();
      const { signal } = controller;
      assert.rejects(() => fetch(
        // `${protocol}://httpstat.us/307`, // unreliable server (frequent 503s)
        `${protocol}://httpbin.org/status/307`,
        { method, body, signal },
      ), FetchError);
    });

    it('supports text body', async () => {
      const method = 'POST';
      const body = 'hello, world!';
      const resp = await fetch(`${baseUrl}/post`, { method, body });
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.httpVersion, httpVersion);
      assert.strictEqual(resp.headers.get('content-type'), 'application/json');
      const jsonResponseBody = await resp.json();
      assert(jsonResponseBody !== null && typeof jsonResponseBody === 'object');
      assert.strictEqual(jsonResponseBody.headers['Content-Type'], 'text/plain; charset=utf-8');
      assert.deepStrictEqual(jsonResponseBody.data, body);
    });

    it('supports stream body', async () => {
      const method = 'POST';
      const body = fs.createReadStream(__filename);
      const resp = await fetch(`${baseUrl}/post`, { method, body });
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.httpVersion, httpVersion);
      assert.strictEqual(resp.headers.get('content-type'), 'application/json');
      const jsonResponseBody = await resp.json();
      assert(jsonResponseBody !== null && typeof jsonResponseBody === 'object');
      assert.deepStrictEqual(jsonResponseBody.data, fs.readFileSync(__filename).toString());
    });

    it('supports URLSearchParams body', async () => {
      const searchParams = {
        name: 'André Citroën',
        rumple: 'stiltskin',
      };
      const method = 'POST';
      const body = new URLSearchParams(searchParams);
      const resp = await fetch(`${baseUrl}/post`, { method, body });
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.httpVersion, httpVersion);
      assert.strictEqual(resp.headers.get('content-type'), 'application/json');
      const jsonResponseBody = await resp.json();
      assert(jsonResponseBody !== null && typeof jsonResponseBody === 'object');
      assert.strictEqual(jsonResponseBody.headers['Content-Type'], 'application/x-www-form-urlencoded; charset=utf-8');
      assert.deepStrictEqual(jsonResponseBody.form, searchParams);
    });

    it('supports FormData body', async () => {
      const searchParams = {
        name: 'André Citroën',
        rumple: 'stiltskin',
      };
      const method = 'POST';
      const form = new FormData();
      Object.entries(searchParams).forEach(([k, v]) => form.append(k, v));

      const resp = await fetch(`${baseUrl}/post`, { method, body: form });
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.httpVersion, httpVersion);
      assert.strictEqual(resp.headers.get('content-type'), 'application/json');
      const jsonResponseBody = await resp.json();
      assert(jsonResponseBody !== null && typeof jsonResponseBody === 'object');
      assert(jsonResponseBody.headers['Content-Type'].startsWith('multipart/form-data;boundary='));
      assert.deepStrictEqual(jsonResponseBody.form, searchParams);
    });
  });
});
