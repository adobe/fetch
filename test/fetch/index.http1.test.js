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

import assert from 'assert';
import { createHash } from 'crypto';

import Server from '../server.js';
import {
  context,
  h1,
  keepAlive,
  h1NoCache,
  keepAliveNoCache,
  ALPN_HTTP1_0,
  ALPN_HTTP1_1,
} from '../../src/index.js';

const testParams = [
  {
    name: 'plain HTTP',
    protocol: 'http',
  },
  {
    name: 'secure HTTP',
    protocol: 'https',
  },
];

testParams.forEach((params) => {
  const {
    name,
    protocol,
  } = params;

  describe(`HTTP/1.x-specific Fetch Tests (${name})`, () => {
    let server;

    before(async () => {
      // start HTTP/1.1 server
      server = await Server.launch(1, protocol === 'https');
    });

    after(async () => {
      process.kill(server.pid);
    });

    it(`forcing HTTP/1.1 using context option works' (${name})`, async () => {
      const { fetch, reset } = context({ alpnProtocols: [ALPN_HTTP1_1] });
      try {
        const resp = await fetch(`${protocol}://httpbin.org/status/200`);
        assert.strictEqual(resp.status, 200);
        assert.strictEqual(resp.httpVersion, '1.1');
      } finally {
        await reset();
      }
    });

    it(`forcing HTTP/1.1 using h1() works' (${name})`, async () => {
      const { fetch, reset } = h1();
      try {
        const resp = await fetch(`${protocol}://httpbin.org/status/200`);
        assert.strictEqual(resp.status, 200);
        assert.strictEqual(resp.httpVersion, '1.1');
      } finally {
        await reset();
      }
    });

    it(`supports h1NoCache() (${name})`, async () => {
      const { fetch, cacheStats, reset } = h1NoCache();
      try {
        let resp = await fetch(`${protocol}://httpbin.org/cache/60`);
        assert.strictEqual(resp.status, 200);
        assert.strictEqual(resp.httpVersion, '1.1');
        // re-fetch (force reuse of custom agent => coverage)
        resp = await fetch(`${protocol}://httpbin.org/cache/60`);
        assert.strictEqual(resp.status, 200);
        assert.strictEqual(resp.httpVersion, '1.1');
        assert(!resp.fromCache);

        const { size, count } = cacheStats();
        assert(size === 0);
        assert(count === 0);
      } finally {
        await reset();
      }
    });

    it(`defaults to 'no keep-alive' (${name})`, async () => {
      const { fetch, reset } = context({ alpnProtocols: [ALPN_HTTP1_1] });
      try {
        const resp = await fetch(`${protocol}://httpbin.org/status/200`);
        assert.strictEqual(resp.status, 200);
        assert.strictEqual(resp.httpVersion, '1.1');
        assert.strictEqual(resp.headers.get('connection'), 'close');
      } finally {
        await reset();
      }
    });

    it(`supports h1.keepAlive context option (${name})`, async () => {
      const { fetch, reset } = context({ alpnProtocols: [ALPN_HTTP1_1], h1: { keepAlive: true } });
      try {
        let resp = await fetch(`${protocol}://httpbin.org/status/200`, { cache: 'no-store' });
        assert.strictEqual(resp.status, 200);
        assert.strictEqual(resp.httpVersion, '1.1');
        assert.strictEqual(resp.headers.get('connection'), 'keep-alive');
        // re-fetch (force reuse of custom agent => coverage)
        resp = await fetch(`${protocol}://httpbin.org/status/200`, { cache: 'no-store' });
        assert.strictEqual(resp.status, 200);
        assert.strictEqual(resp.httpVersion, '1.1');
        assert.strictEqual(resp.headers.get('connection'), 'keep-alive');
      } finally {
        await reset();
      }
    });

    it(`supports keepAlive() (${name})`, async () => {
      const { fetch, reset } = keepAlive();
      try {
        let resp = await fetch(`${protocol}://httpbin.org/status/200`, { cache: 'no-store' });
        assert.strictEqual(resp.status, 200);
        assert.strictEqual(resp.httpVersion, '1.1');
        assert.strictEqual(resp.headers.get('connection'), 'keep-alive');
        // re-fetch (force reuse of custom agent => coverage)
        resp = await fetch(`${protocol}://httpbin.org/status/200`, { cache: 'no-store' });
        assert.strictEqual(resp.status, 200);
        assert.strictEqual(resp.httpVersion, '1.1');
        assert.strictEqual(resp.headers.get('connection'), 'keep-alive');
      } finally {
        await reset();
      }
    });

    it(`supports keepAliveNoCache() (${name})`, async () => {
      const { fetch, reset, cacheStats } = keepAliveNoCache();
      try {
        let resp = await fetch(`${protocol}://httpbin.org/cache/60`);
        assert.strictEqual(resp.status, 200);
        assert.strictEqual(resp.httpVersion, '1.1');
        assert.strictEqual(resp.headers.get('connection'), 'keep-alive');
        // re-fetch (force reuse of custom agent => coverage)
        resp = await fetch(`${protocol}://httpbin.org/cache/60`);
        assert.strictEqual(resp.status, 200);
        assert.strictEqual(resp.httpVersion, '1.1');
        assert.strictEqual(resp.headers.get('connection'), 'keep-alive');
        assert(!resp.fromCache);

        const { size, count } = cacheStats();
        assert(size === 0);
        assert(count === 0);
      } finally {
        await reset();
      }
    });

    it(`supports HTTP/1.0 (${name})`, async () => {
      const { fetch, reset } = context({ alpnProtocols: [ALPN_HTTP1_0] });
      try {
        const resp = await fetch(`${protocol}://httpbin.org/status/200`);
        assert.strictEqual(resp.status, 200);
        assert(['1.0', '1.1'].includes(resp.httpVersion));
      } finally {
        await reset();
      }
    });

    it(`negotiates protocol (${name})`, async () => {
      const { fetch, reset } = context({ alpnProtocols: [ALPN_HTTP1_0, ALPN_HTTP1_1] });
      try {
        const resp = await fetch(`${protocol}://httpbin.org/status/200`);
        assert.strictEqual(resp.status, 200);
        assert(['1.0', '1.1'].includes(resp.httpVersion));
      } finally {
        await reset();
      }
    });

    it(`concurrent HTTP/1.1 requests to same origin (${name})`, async () => {
      const { fetch, reset } = h1NoCache(protocol === 'https' ? { rejectUnauthorized: false } : {});
      const N = 50; // # of parallel requests
      const TEST_URL = `${server.origin}/bytes`;
      // generete array of 'randomized' urls
      const urls = Array.from({ length: N }, () => Math.floor(Math.random() * N)).map((num) => `${TEST_URL}?count=${num}`);

      let responses;
      try {
        // send requests
        responses = await Promise.all(urls.map((url) => fetch(url)));
        // read bodies
        await Promise.all(responses.map((resp) => resp.arrayBuffer()));
      } finally {
        await reset();
      }
      const ok = responses.filter((res) => res.ok && res.httpVersion === '1.1');
      assert.strictEqual(ok.length, N);
    });

    it(`handles concurrent HTTP/1.1 requests to subdomains sharing the same IP address (${name})`, async () => {
      const { fetch, reset } = context({ alpnProtocols: [ALPN_HTTP1_1] });

      const doFetch = async (url) => {
        const res = await fetch(url);
        assert.strictEqual(res.httpVersion, '1.1');
        const data = await res.text();
        return createHash('md5').update(data).digest().toString('hex');
      };

      let results;
      try {
        results = await Promise.all([
          doFetch(`${protocol}://en.wikipedia.org/wiki/42`),
          doFetch(`${protocol}://fr.wikipedia.org/wiki/42`),
          doFetch(`${protocol}://it.wikipedia.org/wiki/42`),
        ]);
      } finally {
        await reset();
      }

      assert.strictEqual(results.length, 3);
      assert.notStrictEqual(results[0], results[1]);
      assert.notStrictEqual(results[0], results[2]);
      assert.notStrictEqual(results[1], results[2]);
    });

    it(`concurrent HTTP/1.1 requests to same origin using different contexts (${name})`, async () => {
      const doFetch = async (ctx, url) => ctx.fetch(url);

      const N = 50; // # of parallel requests
      const contexts = Array.from({ length: N }, () => h1NoCache(protocol === 'https' ? { rejectUnauthorized: false } : {}));
      const TEST_URL = `${server.origin}/bytes`;
      // generete array of 'randomized' urls
      const args = contexts
        .map((ctx) => ({ ctx, num: Math.floor(Math.random() * N) }))
        .map(({ ctx, num }) => ({ ctx, url: `${TEST_URL}?count=${num}` }));
      // send requests
      const responses = await Promise.all(args.map(({ ctx, url }) => doFetch(ctx, url)));
      // cleanup
      await Promise.all(contexts.map((ctx) => ctx.reset()));
      const ok = responses.filter((res) => res.ok && res.httpVersion === '1.1');
      assert.strictEqual(ok.length, N);
    });
  });
});
