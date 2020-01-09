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

const nock = require('nock');

const { fetch, disconnectAll } = require('../src/index.js');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Fetch Tests', () => {
  afterEach(async () => {
    // disconnect all sessions
    await disconnectAll();
  });

  it.skip('fetch supports HTTP/1(.1)', async () => {
    const resp = await fetch('https://httpbin.org/status/200');
    assert.equal(resp.status, 200);
    assert.equal(resp.httpVersion, 1);
  });

  it('fetch supports HTTP/2', async () => {
    const resp = await fetch('https://www.nghttp2.org/httpbin/status/200');
    assert.equal(resp.status, 200);
    assert.equal(resp.httpVersion, 2);
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

  it('fetch supports HTTP/2 server push', async () => {
    // see https://nghttp2.org/blog/2015/02/10/nghttp2-dot-org-enabled-http2-server-push/
    const resp = await fetch('https://nghttp2.org');
    assert.equal(resp.httpVersion, 2);
    assert.equal(resp.status, 200);
    // wait a second...
    await sleep(1000);
    // check cache for pushed resource (stylesheets/screen.css)
    const pushedResp = await fetch('https://nghttp2.org/stylesheets/screen.css');
    assert.equal(pushedResp.httpVersion, 2);
    assert.equal(pushedResp.status, 200);
    // make sure it's delivered from cache
    assert(pushedResp.fromCache);
  });
});
