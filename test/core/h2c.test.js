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
const http2 = require('http2');
const { finished } = require('stream');
const { promisify } = require('util');

const isStream = require('is-stream');
const { WritableStreamBuffer } = require('stream-buffers');

const streamFinished = promisify(finished);

const { request, reset } = require('../../src/core');

const readStream = async (stream) => {
  const out = new WritableStreamBuffer();
  stream.pipe(out);
  return streamFinished(out).then(() => out.getContents());
};

const HELLO_WORLD = 'Hello, World!';

// unencrypted HTTP/2 (h2c) server
class H2Server {
  constructor() {
    this.server = null;
    this.sessions = new Set();
  }

  async start(port = 0) {
    if (this.server) {
      throw Error('server already started');
    }
    const server = http2.createServer();
    server.once('error', (err) => {
      throw err;
    });
    server.once('close', () => {
      this.server = null;
      this.sessions.clear();
    });
    server.on('session', (session) => this.sessions.add(session));
    server.on('stream', (stream, headers) => {
      const { pathname } = new URL(`${headers[':scheme']}://${headers[':authority']}${headers[':path']}`);
      switch (pathname) {
        case '/hello':
          stream.respond({ ':status': 200 });
          stream.end(HELLO_WORLD);
          break;

        default:
          stream.respond({ ':status': 404 });
          stream.end('Not found!');
      }
    });
    return new Promise((resolve) => {
      server.listen(port, () => {
        this.server = server;
        resolve();
      });
    });
  }

  get port() {
    if (!this.server) {
      throw Error('server not started');
    }
    return this.server.address().port;
  }

  get origin() {
    const { port } = this;
    return `http2://localhost:${port}`;
  }

  async close() {
    if (!this.server) {
      throw Error('server not started');
    }
    return new Promise((resolve) => this.server.close(resolve));
  }
}

describe('unencrypted HTTP/2 (h2c)-specific Core Tests', () => {
  let server;
  let origin;

  before(async () => {
    // start test server
    server = new H2Server();
    await server.start();
    origin = server.origin;
  });

  after(async () => {
    await reset();
    await server.close();
  });

  it('supports unencrypted HTTP/2 (h2c)', async () => {
    const resp = await request(`${origin}/hello`);
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(resp.httpVersionMajor, 2);
    assert(isStream.readable(resp.readable));

    const buf = await readStream(resp.readable);
    assert.strictEqual(buf.toString(), HELLO_WORLD);
  });
});
