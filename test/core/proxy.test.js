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

const assert = require('assert');
const tunnel = require('tunnel');
const Proxy = require('proxy');
const { context, ALPN_HTTP1_1, ALPN_HTTP1_0 } = require('../../src/core');

// This should go into our code base
const createSocketFactory = (port) => {
  // Always use `httpOverHttp` - secure handshake is handled in the `helix-fetch` request layer.
  // This is for HTTP proxy support, we still need to figure out how to support HTTPs proxy.
  const tunnelingAgent = tunnel.httpOverHttp({
    proxy: {
      host: 'localhost',
      port,
    },
  });
  // Promisify the `createSocket` method of the `tunnelingAgent`
  const createSocket = (requestOptions) => new Promise((resolve) => {
    tunnelingAgent.createSocket(requestOptions, (socket) => {
      resolve(socket);
    });
  });
  return createSocket;
};

describe('Proxy tests', () => {
  let proxy;
  let proxyPort;

  before((done) => {
    proxy = Proxy();
    proxy.listen(() => {
      proxyPort = proxy.address().port;
      done();
    });
  });

  after((done) => {
    proxy.once('close', () => {
      done();
    });
    proxy.close();
  });

  it('Tunnel to HTTP 1.1 server using HTTP over HTTP proxy', async () => {
    const customCtx = context({
      socketFactory: createSocketFactory(proxyPort),
    });
    try {
      const resp = await customCtx.request('http://httpbin.org/status/200');
      assert.strictEqual(resp.statusCode, 200);
      assert.strictEqual(resp.httpVersionMajor, 1);
    } finally {
      await customCtx.reset();
    }
  });

  it('Tunnel to HTTP 1.0 server with HTTPS over HTTP proxy', async () => {
    const customCtx = context({
      // Make sure we don't upgrade to HTTP2
      alpnProtocols: [ALPN_HTTP1_0],
      socketFactory: createSocketFactory(proxyPort),
    });
    try {
      const resp = await customCtx.request('https://httpbin.org/status/200');
      assert.strictEqual(resp.statusCode, 200);
      assert.strictEqual(resp.httpVersionMajor, 1);
    } finally {
      await customCtx.reset();
    }
  });

  it('Tunnel to HTTP 1.1 server with HTTPS over HTTP proxy', async () => {
    const customCtx = context({
      // Make sure we don't upgrade to HTTP2
      alpnProtocols: [ALPN_HTTP1_1],
      socketFactory: createSocketFactory(proxyPort),
    });
    try {
      const resp = await customCtx.request('https://httpbin.org/status/200');
      assert.strictEqual(resp.statusCode, 200);
      assert.strictEqual(resp.httpVersionMajor, 1);
    } finally {
      await customCtx.reset();
    }
  });

  it('Tunnel to HTTP2 server using HTTPS over HTTP proxy', async () => {
    const customCtx = context({
      socketFactory: createSocketFactory(proxyPort),
    });
    try {
      const resp = await customCtx.request('https://www.nghttp2.org/httpbin/status/200');
      assert.strictEqual(resp.statusCode, 200);
      assert.strictEqual(resp.httpVersionMajor, 2);
    } finally {
      await customCtx.reset();
    }
  });

  it('Tunnel to HTTP 1.1 server using HTTP over HTTP proxy using specific port', async () => {
    const customCtx = context({
      socketFactory: createSocketFactory(proxyPort),
    });
    try {
      const resp = await customCtx.request('http://portquiz.net:666/');
      assert.strictEqual(resp.statusCode, 200);
      assert.strictEqual(resp.httpVersionMajor, 2);
    } finally {
      await customCtx.reset();
    }
  });
});
