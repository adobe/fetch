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
const { finished } = require('stream');
const { promisify } = require('util');

const { WritableStreamBuffer } = require('stream-buffers');

const { AbortController } = require('../../src/fetch/abort');
const { context, ALPN_HTTP1_1 } = require('../../src/core');
const { RequestAbortedError } = require('../../src/core/errors');

const streamFinished = promisify(finished);

const readStream = async (stream) => {
  const out = new WritableStreamBuffer();
  stream.pipe(out);
  return streamFinished(out).then(() => out.getContents());
};

const WOKEUP = 'woke up!';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms, WOKEUP));

describe('Misc. Core Tests (edge cases to improve code coverage)', () => {
  let defaultCtx;

  before(async () => {
    defaultCtx = context();
  });

  after(async () => {
    await defaultCtx.reset();
  });

  it('AbortController works (premature abort) (code coverage, HTTP/1.1)', async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 0);
    const { signal } = controller;

    // make sure signal has fired
    await sleep(10);
    assert(signal.aborted);

    // force HTTP/1.1
    const customCtx = context({ alpnProtocols: [ALPN_HTTP1_1] });

    let ts0;
    try {
      // first prime alpn cache
      await customCtx.request('https://httpbin.org/status/200');
      // now send request with signal
      ts0 = Date.now();
      await customCtx.request('https://httpbin.org/status/200', { signal });
      assert.fail();
    } catch (err) {
      assert(err instanceof RequestAbortedError);
    } finally {
      await customCtx.reset();
    }
    const ts1 = Date.now();
    assert((ts1 - ts0) < 10);
  });

  it('supports text body (code coverage, HTTP/1.1)', async () => {
    const method = 'POST';
    const body = 'hello, world!';

    // force HTTP/1.1
    const customCtx = context({ alpnProtocols: [ALPN_HTTP1_1] });

    try {
      const resp = await customCtx.request('https://httpbin.org/post', { method, body });
      assert.strictEqual(resp.statusCode, 200);
      assert.strictEqual(resp.headers['content-type'], 'application/json');
      const buf = await readStream(resp.readable);
      const jsonResponseBody = JSON.parse(buf);
      assert(typeof jsonResponseBody === 'object');
      assert.strictEqual(jsonResponseBody.headers['Content-Type'], 'text/plain; charset=utf-8');
      assert.deepStrictEqual(jsonResponseBody.data, body);
    } finally {
      await customCtx.reset();
    }
  });
});
