/*
 * Copyright 2021 Adobe. All rights reserved.
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

const { Server } = require('../server');
const { context } = require('../../src/fetch');

describe('Redirect-specific Fetch Tests', () => {
  it('connection error in redirected http/1.1 location is handled correctly', async () => {
    // start http/1.1 server
    const server = new Server(1);
    await server.start();

    const ctx = context({ rejectUnauthorized: false });

    try {
      // redirected request works
      let location = `${server.origin}/hello`;
      let url = `${server.origin}/redirect-to?url=${encodeURIComponent(location)}&status_code=302`;
      const resp = await ctx.fetch(url, { cache: 'no-store' });
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.httpVersion, '1.1');
      assert.strictEqual(resp.redirected, true);

      // redirected request is aborted
      location = `${server.origin}/abort`;
      url = `${server.origin}/redirect-to?url=${encodeURIComponent(location)}&status_code=302`;
      await assert.rejects(async () => ctx.fetch(url, { cache: 'no-store' }), { name: 'FetchError', code: 'ECONNRESET' });
    } finally {
      await ctx.reset();
      // shutdown server
      await server.close();
    }
  });

  it('connection error in redirected http/2 location is handled correctly', async () => {
    // start http/2 server
    const server = new Server(2);
    await server.start();

    const ctx = context({ rejectUnauthorized: false });

    try {
      // redirected request works
      let location = `${server.origin}/hello`;
      let url = `${server.origin}/redirect-to?url=${encodeURIComponent(location)}&status_code=302`;
      const resp = await ctx.fetch(url, { cache: 'no-store' });
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.httpVersion, '2.0');
      assert.strictEqual(resp.redirected, true);

      // redirected request is aborted
      location = `${server.origin}/abort`;
      url = `${server.origin}/redirect-to?url=${encodeURIComponent(location)}&status_code=302`;
      await assert.rejects(async () => ctx.fetch(url, { cache: 'no-store' }), { name: 'FetchError', code: 'ERR_HTTP2_SESSION_ERROR' });
    } finally {
      await ctx.reset();
      // shutdown server
      await server.close();
    }
  });
});
