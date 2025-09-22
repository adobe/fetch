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

import assert from 'assert';
import { finished } from 'stream';
import { promisify } from 'util';

import { WritableStreamBuffer } from 'stream-buffers';

import { AbortController } from '../../src/fetch/abort.js';
import { RequestAbortedError } from '../../src/core/errors.js';
import core from '../../src/core/index.js';
import Server from '../server.js';

const { context, ALPN_HTTP1_1 } = core;

const streamFinished = promisify(finished);

const readStream = async (stream) => {
  const out = new WritableStreamBuffer();
  stream.pipe(out);
  return streamFinished(out).then(() => out.getContents());
};

const WOKEUP = 'woke up!';
const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms, WOKEUP);
});

describe('Misc. Core Tests (edge cases to improve code coverage)', () => {
  it('AbortController works (premature abort) (code coverage, HTTP/1.1)', async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 0);
    const { signal } = controller;

    // make sure signal has fired
    await sleep(10);
    assert(signal.aborted);

    // force HTTP/1.1
    const customCtx = context({ alpnProtocols: [ALPN_HTTP1_1], rejectUnauthorized: false });

    const server = await Server.launch(1);

    let ts0;
    try {
      // first prime alpn cache
      await customCtx.request(`${server.origin}/status/200`);
      // now send request with signal
      ts0 = Date.now();
      await customCtx.request(`${server.origin}/status/200`, { signal });
      assert.fail();
    } catch (err) {
      assert(err instanceof RequestAbortedError);
    } finally {
      await customCtx.reset();
      try {
        process.kill(server.pid);
      } catch (ignore) { /* ignore */ }
    }
    const ts1 = Date.now();
    assert((ts1 - ts0) < 10);
  });

  it('supports text body (code coverage, HTTP/1.1)', async () => {
    const method = 'POST';
    const body = 'Hello, World!';

    // force HTTP/1.1
    const customCtx = context({ alpnProtocols: [ALPN_HTTP1_1], rejectUnauthorized: false });

    const server = await Server.launch(1);

    try {
      const resp = await customCtx.request(`${server.origin}/inspect`, { method, body });
      assert.strictEqual(resp.statusCode, 200);
      assert.strictEqual(resp.httpVersionMajor, 1);
      assert.strictEqual(resp.headers['content-type'], 'application/json');
      const buf = await readStream(resp.readable);
      const json = JSON.parse(buf);
      assert(typeof json === 'object');
      assert.strictEqual(json.headers['content-type'], 'text/plain; charset=utf-8');
      assert.strictEqual(+json.headers['content-length'], body.length);
      assert.strictEqual(json.body, body);
    } finally {
      await customCtx.reset();
      try {
        process.kill(server.pid);
      } catch (ignore) { /* ignore */ }
    }
  });
});
