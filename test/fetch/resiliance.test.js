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

const { Server } = require('../server');
const { context } = require('../../src/fetch');

const HELLO_MSG = 'Hello, World!';

describe('Fetch Resiliance Tests', () => {
  it('handles server restart', async () => {
    // start server
    const server = new Server(2, true, HELLO_MSG);
    await server.start();

    const ctx = context({ rejectUnauthorized: false });
    try {
      let resp = await ctx.fetch(`${server.origin}/hello`);
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.httpVersion, '2.0');
      let body = await resp.text();
      assert.strictEqual(body, HELLO_MSG);

      // restart server
      await server.restart();

      resp = await ctx.fetch(`${server.origin}/hello`);
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.httpVersion, '2.0');
      body = await resp.text();
      assert.strictEqual(body, HELLO_MSG);
    } finally {
      await ctx.reset();
      await server.close();
    }
  });

  it('handles aborted request', async () => {
    // start server
    const server = new Server(2, true, HELLO_MSG);
    await server.start();

    const ctx = context({ rejectUnauthorized: false });
    try {
      let resp = await ctx.fetch(`${server.origin}/hello`);
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.httpVersion, '2.0');
      let body = await resp.text();
      assert.strictEqual(body, HELLO_MSG);

      // request is aborted by the server
      await assert.rejects(async () => ctx.fetch(`${server.origin}/abort`, { cache: 'no-store' }), { name: 'FetchError', code: 'ERR_HTTP2_SESSION_ERROR' });

      // try again
      resp = await ctx.fetch(`${server.origin}/hello`);
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.httpVersion, '2.0');
      body = await resp.text();
      assert.strictEqual(body, HELLO_MSG);
    } finally {
      await ctx.reset();
      await server.close();
    }
  });
});
