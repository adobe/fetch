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

const { fetch, onPush, offPush, disconnectAll } = require('../src/index.js');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Fetch Tests', () => {
  afterEach(async () => {
    // disconnect all sessions
    await disconnectAll();
  });

  it('fetch supports HTTP/1(.1)', async () => {
    const resp = await fetch('https://httpbin.org/status/200');
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
    assert.equal(resp.httpVersion, 1);
    assert(isStream.readable(resp.body));
  });

  it('fetch supports json response body', async () => {
    const resp = await fetch('https://httpbin.org/json');
    assert.equal(resp.status, 200);
    assert.equal(resp.httpVersion, 1);
    assert.equal(resp.headers.get('content-type'), 'application/json');
    const json = await resp.json();
    assert(json !== null && typeof json === 'object');
  });

  it('fetch provides caching', async () => {
    const url = 'https://httpbin.org/cache/60';
    // send request
    const resp = await fetch(url);
    assert.equal(resp.status, 200);

    // send same request again, this time with network disabled
    nock.disableNetConnect();
    try {
      const resp2 = await fetch(url);
      assert.equal(resp2.status, 200);
      assert(resp2.fromCache);
    } finally {
      nock.cleanAll();
      nock.enableNetConnect();
    }

    // send same request again, this time with cache disabled
    const resp3 = await fetch(url, { cache: 'no-cache' });
    assert.equal(resp3.status, 200);
    assert(!resp3.fromCache);
  });

  // eslint-disable-next-line func-names
  it('fetch supports HTTP/2 server push', async function () {
    this.timeout(5000);

    const pushUrlPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject();
      }, 2000);
      const handler = (url) => {
        offPush(handler);
        clearTimeout(timeout);
        resolve(url);
      };
      // register event handler
      onPush(handler);
    });

    // see https://nghttp2.org/blog/2015/02/10/nghttp2-dot-org-enabled-http2-server-push/
    const resp = await fetch('https://nghttp2.org');
    assert.equal(resp.httpVersion, 2);
    assert.equal(resp.status, 200);
    assert.equal(resp.headers.get('content-type'), 'text/html');
    assert.equal(resp.headers.get('content-length'), (await resp.text()).length);

    const url = await pushUrlPromise;
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
});
