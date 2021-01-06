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

const {
  context,
  ALPN_HTTP1_1,
} = require('../../src/fetch');

describe('HTTP/1.1-specific Fetch Tests', () => {
  it('defaults to \'no keep-alive\'', async () => {
    const { fetch, reset } = context({ alpnProtocols: [ALPN_HTTP1_1] });
    try {
      const resp = await fetch('https://httpbin.org/status/200');
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.headers.get('connection'), 'close');
    } finally {
      await reset();
    }
  });

  it('supports keep-alive', async () => {
    const { fetch, reset } = context({ alpnProtocols: [ALPN_HTTP1_1], h1: { keepAlive: true } });
    try {
      const resp = await fetch('https://httpbin.org/status/200');
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.headers.get('connection'), 'keep-alive');
    } finally {
      await reset();
    }
  });

  it('concurrent HTTP/1.1 requests to same origin', async function test() {
    this.timeout(5000);

    const { fetch, reset } = context({ alpnProtocols: [ALPN_HTTP1_1] });
    const N = 500; // # of parallel requests
    const TEST_URL = 'https://httpbin.org/bytes/';
    // generete array of 'randomized' urls
    const urls = Array.from({ length: N }, () => Math.floor(Math.random() * N)).map((num) => `${TEST_URL}${num}`);

    let responses;
    try {
      // send requests
      responses = await Promise.all(urls.map((url) => fetch(url)));
      // read bodies
      await Promise.all(responses.map((resp) => resp.text()));
    } finally {
      await reset();
    }
    const ok = responses.filter((res) => res.ok && res.httpVersion === '1.1');
    assert.strictEqual(ok.length, N);
  });

  it('handles concurrent HTTP/1.1 requests to subdomains sharing the same IP address (using wildcard SAN cert)', async () => {
    const { fetch, reset } = context({ alpnProtocols: [ALPN_HTTP1_1] });

    const doFetch = async (url) => {
      const res = await fetch(url);
      assert.strictEqual(res.httpVersion, '1.1');
      const data = await res.text();
      return crypto.createHash('md5').update(data).digest().toString('hex');
    };

    let results;
    try {
      results = await Promise.all([
        doFetch('https://en.wikipedia.org/wiki/42'),
        doFetch('https://fr.wikipedia.org/wiki/42'),
        doFetch('https://it.wikipedia.org/wiki/42'),
      ]);
    } finally {
      await reset();
    }

    assert.strictEqual(results.length, 3);
    assert.notStrictEqual(results[0], results[1]);
    assert.notStrictEqual(results[0], results[2]);
    assert.notStrictEqual(results[1], results[2]);
  });
});
