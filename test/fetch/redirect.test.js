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
const https = require('https');
const util = require('util');

const pem = require('pem');

const { context } = require('../../src/fetch');

const createCertificate = util.promisify(pem.createCertificate);

describe('Redirect-specific Fetch Tests', () => {
  it('connection error in redirected location is handled correctly', async () => {
    // setup & start unfriendly server
    const keys = await createCertificate({ selfSigned: true });
    const options = {
      key: keys.serviceKey,
      cert: keys.certificate,
    };
    let server;
    await new Promise((resolve, reject) => {
      server = https.createServer(options, (req) => {
        // abort every request
        req.socket.destroy();
      }).listen(0)
        .on('error', reject)
        .on('listening', resolve);
    });

    const ctx = context({ rejectUnauthorized: false });

    const location = `https://localhost:${server.address().port}/`;
    try {
      const url = `https://httpbingo.org/redirect-to?url=${encodeURIComponent(location)}&status_code=302`;
      await ctx.fetch(url, { cache: 'no-store' });
      assert.fail('redirect should fail');
    } catch (e) {
      assert(e.code === 'ECONNRESET');
    } finally {
      // shutdown server
      server.close();
      ctx.reset();
    }
  });
});
