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
import { finished } from 'stream';
import { promisify } from 'util';

import { WritableStreamBuffer } from 'stream-buffers';

import { isReadableStream } from '../utils.js';
import Server from '../server.js';
import core from '../../src/core/index.js';

const { request, reset } = core;
const streamFinished = promisify(finished);

const readStream = async (stream) => {
  const out = new WritableStreamBuffer();
  stream.pipe(out);
  return streamFinished(out).then(() => out.getContents());
};

const HELLO_WORLD = 'Hello, World!';

describe('unencrypted HTTP/2 (h2c)-specific Core Tests', () => {
  let server;

  before(async () => {
    // start unencrypted HTTP/2 (h2c) server
    server = await Server.launch(2, false, HELLO_WORLD);
  });

  after(async () => {
    await reset();
    try {
      process.kill(server.pid);
    } catch (ignore) { /* ignore */ }
  });

  it('supports unencrypted HTTP/2 (h2c)', async () => {
    const resp = await request(`${server.origin}/hello`);
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(resp.httpVersionMajor, 2);
    assert(isReadableStream(resp.readable));

    const buf = await readStream(resp.readable);
    assert.strictEqual(buf.toString(), HELLO_WORLD);
  });
});
