/*
 * Copyright 2019 Adobe. All rights reserved.
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

const isStream = require('is-stream');
const nock = require('nock');
const parseCacheControl = require('parse-cache-control');

const {
  fetch, onPush, offPush, disconnectAll, clearCache,
} = require('../src/index.js');

const WOKEUP = 'woke up!';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms, WOKEUP));

describe('Fetch Tests', () => {
  afterEach(async () => {
    // clear client cache
    clearCache();
    // disconnect all sessions
    await disconnectAll();
  });

  it('fetch supports HTTP/1(.1)', async () => {
    const resp = await fetch('http://httpbin.org/status/200');
    assert.equal(resp.status, 200);
    assert.equal(resp.httpVersion, 1);
  });

  it('fetch supports HTTP/2', async () => {
    const resp = await fetch('https://www.nghttp2.org/httpbin/status/200');
    assert.equal(resp.status, 200);
    assert.equal(resp.httpVersion, 2);
  });

  it('response.body is a readable stream', async () => {
    const resp = await fetch('https://httpbin.org/status/200');
    assert.equal(resp.status, 200);
    assert(isStream.readable(resp.body));
  });

  it('fetch supports json response body', async () => {
    const resp = await fetch('https://httpbin.org/json');
    assert.equal(resp.status, 200);
    assert.equal(resp.headers.get('content-type'), 'application/json');
    const json = await resp.json();
    assert(json !== null && typeof json === 'object');
  });

  it('fetch supports json POST', async () => {
    const method = 'POST';
    const json = { foo: 'bar' };
    const headers = { accept: 'application/json' };
    const resp = await fetch('https://httpbin.org/post', { method, json, headers });
    assert.equal(resp.status, 200);
    assert.equal(resp.headers.get('content-type'), 'application/json');
    const jsonResponseBody = await resp.json();
    assert(jsonResponseBody !== null && typeof jsonResponseBody === 'object');
    assert.deepEqual(jsonResponseBody.json, json);
  });

  it('fetch supports caching', async () => {
    const url = 'https://httpbin.org/cache/60'; // -> max-age=2 (seconds)
    // send request (prime cache)
    let resp = await fetch(url);
    assert.equal(resp.status, 200);

    // re-send request and make sure it's served from cache
    resp = await fetch(url);
    assert.equal(resp.status, 200);
    assert(resp.fromCache);

    // re-send request, this time with network disabled
    nock.disableNetConnect();
    try {
      resp = await fetch(url);
      assert.equal(resp.status, 200);
      assert(resp.fromCache);
    } finally {
      nock.cleanAll();
      nock.enableNetConnect();
    }

    // re-send request, this time with cache disabled via option
    resp = await fetch(url, { cache: 'no-store' });
    assert.equal(resp.status, 200);
    assert(!resp.fromCache);
  });

  it('clearCache works', async () => {
    const url = 'https://httpbin.org/cache/60'; // -> max-age=2 (seconds)
    // send request (prime cache)
    let resp = await fetch(url);
    assert.equal(resp.status, 200);
    const cc = parseCacheControl(resp.headers.get('cache-control'));
    assert(cc);
    assert.equal(cc['max-age'], 60);

    // re-send request and make sure it's served from cache
    resp = await fetch(url);
    assert.equal(resp.status, 200);
    assert(resp.fromCache);

    // clear client cache
    clearCache();

    // re-send request, make sure it's returning a fresh response
    resp = await fetch(url);
    assert.equal(resp.status, 200);
    assert(!resp.fromCache);
  });

  // eslint-disable-next-line func-names
  it('fetch supports max-age directive', async function () {
    this.timeout(5000);

    // max-age=3 seconds
    const url = 'https://httpbin.org/cache/3';
    // send request
    let resp = await fetch(url);
    assert.equal(resp.status, 200);
    const cc = parseCacheControl(resp.headers.get('cache-control'));
    assert(cc);
    assert.equal(cc['max-age'], 3);
    // wait a second...
    await sleep(1000);
    // re-send request and make sure it's served from cache
    resp = await fetch(url);
    assert.equal(resp.status, 200);
    assert(parseInt(resp.headers.get('age'), 10) > 0);
    assert(resp.fromCache);
    // wait another 2 seconds to make sure max-age expires...
    await sleep(2000);
    // re-send request and make sure it's not served from cache
    resp = await fetch(url);
    assert.equal(resp.status, 200);
    assert(!resp.fromCache);
  });

  it('fetch supports max-age=0', async () => {
    const url = 'https://httpbin.org/cache/0';
    let resp = await fetch(url);
    assert.equal(resp.status, 200);
    const cc = parseCacheControl(resp.headers.get('cache-control'));
    assert.equal(cc['max-age'], 0);
    // re-send request and make sure it's not served from cache
    resp = await fetch(url);
    assert.equal(resp.status, 200);
    assert(!resp.fromCache);
  });

  it('fetch supports no-store directive', async () => {
    // send request with no-store directive
    const resp = await fetch('https://httpbin.org/image/jpeg', { headers: { 'cache-control': 'no-store' } });
    assert.equal(resp.status, 200);
    assert(!resp.fromCache);
  });

  // eslint-disable-next-line func-names
  it('fetch supports HTTP/2 server push', async function () {
    this.timeout(5000);

    // returns a promise which resolves with the url of the pushed resource
    const receivedPush = () => new Promise((resolve) => {
      const handler = (url) => {
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
    assert.equal(resp.httpVersion, 2);
    assert.equal(resp.status, 200);
    assert.equal(resp.headers.get('content-type'), 'text/html');
    assert.equal(resp.headers.get('content-length'), (await resp.text()).length);
    assert.notEqual(url, WOKEUP);

    // check cache for pushed resource (stylesheets/screen.css)
    nock.disableNetConnect();
    try {
      const pushedResp = await fetch(url);
      assert.equal(pushedResp.httpVersion, 2);
      assert.equal(pushedResp.status, 200);
      assert(pushedResp.fromCache);
    } finally {
      nock.cleanAll();
      nock.enableNetConnect();
    }
  });

  // eslint-disable-next-line func-names
  it('test redundant server push', async function () {
    this.timeout(5000);

    const receivedPush = () => new Promise((resolve) => onPush(resolve));

    let [resp, result] = await Promise.all([
      // see https://nghttp2.org/blog/2015/02/10/nghttp2-dot-org-enabled-http2-server-push/
      fetch('https://nghttp2.org', { cache: 'no-store' }),
      // resolves with either WOKEUP or the url of the pushed resource
      Promise.race([sleep(2000), receivedPush()]),
    ]);
    assert.equal(resp.httpVersion, 2);
    assert.equal(resp.status, 200);
    assert.notEqual(result, WOKEUP);

    // re-trigger push
    [resp, result] = await Promise.all([
      fetch('https://nghttp2.org', { cache: 'no-store' }),
      Promise.race([sleep(2000), receivedPush()]),
    ]);
    assert.equal(resp.httpVersion, 2);
    assert.equal(resp.status, 200);
    assert.notEqual(result, WOKEUP);
  });
});
