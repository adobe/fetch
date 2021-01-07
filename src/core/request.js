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

'use strict';

const tls = require('tls');

const LRU = require('lru-cache');
const debug = require('debug')('helix-fetch:core');

const { RequestAbortedError } = require('./errors');
const h1 = require('./h1');
const h2 = require('./h2');
const lock = require('./lock');
const { isPlainObject } = require('../common/utils');

const { version } = require('../../package.json');

const ALPN_HTTP2 = 'h2';
const ALPN_HTTP2C = 'h2c';
const ALPN_HTTP1_0 = 'http/1.0';
const ALPN_HTTP1_1 = 'http/1.1';

// context option defaults
const ALPN_CACHE_SIZE = 100; // # of entries
const ALPN_CACHE_TTL = 60 * 60 * 1000; // (ms): 1h
const ALPN_PROTOCOLS = [ALPN_HTTP2, ALPN_HTTP1_1, ALPN_HTTP1_0];

const DEFAULT_USER_AGENT = `helix-fetch/${version}`;

// request option defaults
const DEFAULT_OPTIONS = {
  method: 'GET',
  compress: true,
};

let socketIdCounter = 0;

const connectionLock = lock();

const connectTLS = (url, options) => new Promise((resolve, reject) => {
  // intercept abort signal in order to cancel connect
  const { signal } = options;
  let socket;
  const onAbortSignal = () => {
    signal.removeEventListener('abort', onAbortSignal);
    const err = new RequestAbortedError();
    reject(err);
    /* istanbul ignore else */
    if (socket) {
      socket.destroy(err);
    }
  };
  if (signal) {
    if (signal.aborted) {
      reject(new RequestAbortedError());
      return;
    }
    signal.addEventListener('abort', onAbortSignal);
  }

  const port = +url.port || 443;

  const onError = (err) => {
    // error occured while connecting
    if (signal) {
      signal.removeEventListener('abort', onAbortSignal);
    }
    if (!(err instanceof RequestAbortedError)) {
      debug(`connecting to ${url.hostname}:${port} failed with: ${err.message}`);
      reject(err);
    }
  };

  socket = tls.connect(port, url.hostname, options);
  socket.once('secureConnect', () => {
    if (signal) {
      signal.removeEventListener('abort', onAbortSignal);
    }
    socket.off('error', onError);
    socketIdCounter += 1;
    socket.id = socketIdCounter;
    // workaround for node >= 12.17.0 regression
    // (see https://github.com/nodejs/node/pull/34859)
    socket.secureConnecting = false;
    debug(`established TLS connection: #${socket.id} (${socket.servername})`);
    resolve(socket);
  });
  socket.once('error', onError);
});

const connect = async (url, options) => {
  // use mutex to avoid concurrent socket creation to same origin
  let socket = await connectionLock.acquire(url.origin);
  try {
    if (!socket) {
      socket = await connectTLS(url, options);
    }
    return socket;
  } finally {
    connectionLock.release(url.origin, socket);
  }
};

const determineProtocol = async (ctx, url, signal) => {
  // url.origin is null if url.protocol is neither 'http:' nor 'https:' ...
  const origin = `${url.protocol}//${url.host}`;
  // lookup ALPN cache
  let protocol = ctx.alpnCache.get(origin);
  if (protocol) {
    return { protocol };
  }
  switch (url.protocol) {
    case 'http:':
      // for simplicity we assume unencrypted HTTP to be HTTP/1.1
      // (although, theoretically, it could also be plain-text HTTP/2 (h2c))
      protocol = ALPN_HTTP1_1;
      ctx.alpnCache.set(origin, protocol);
      return { protocol };

    case 'http2:':
      // HTTP/2 over TCP (h2c)
      protocol = ALPN_HTTP2C;
      ctx.alpnCache.set(origin, protocol);
      return { protocol };

    case 'https:':
      // need to negotiate protocol
      break;

    default:
      throw new TypeError(`unsupported protocol: ${url.protocol}`);
  }

  // negotioate via ALPN
  const {
    options: {
      rejectUnauthorized: _rejectUnauthorized,
      h1: h1Opts = {},
      h2: h2Opts = {},
    },
  } = ctx;
  const rejectUnauthorized = !((_rejectUnauthorized === false
    || h1Opts.rejectUnauthorized === false
    || h2Opts.rejectUnauthorized === false));
  const connectOptions = {
    servername: url.hostname, // enable SNI (Server Name Indication) extension
    ALPNProtocols: ctx.alpnProtocols,
    signal, // optional abort signal
    rejectUnauthorized,
  };
  const socket = await connect(url, connectOptions);
  // socket.alpnProtocol contains the negotiated protocol (e.g. 'h2', 'http1.1', 'http1.0')
  protocol = socket.alpnProtocol;
  /* istanbul ignore if */
  if (!protocol) {
    protocol = ALPN_HTTP1_1; // default fallback
  }
  ctx.alpnCache.set(origin, protocol);
  return { protocol, socket };
};

const sanitizeHeaders = (headers) => {
  const result = {};
  // make all header names lower case
  Object.keys(headers).forEach((name) => {
    result[name.toLowerCase()] = headers[name];
  });
  return result;
};

const request = async (ctx, uri, options) => {
  const url = new URL(uri);

  const opts = { ...DEFAULT_OPTIONS, ...(options || {}) };

  // sanitze method name
  if (typeof opts.method === 'string') {
    opts.method = opts.method.toUpperCase();
  }
  // sanitize headers (lowercase names)
  opts.headers = sanitizeHeaders(opts.headers || {});
  // set Host header if none is provided
  if (!opts.headers.host) {
    opts.headers.host = url.host;
  }
  // User-Agent header
  if (ctx.userAgent) {
    if (!opts.headers['user-agent']) {
      opts.headers['user-agent'] = ctx.userAgent;
    }
  }
  // some header magic
  if (opts.body instanceof URLSearchParams) {
    opts.headers['content-type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
    opts.body = opts.body.toString();
  } else if (typeof opts.body === 'string' || opts.body instanceof String) {
    if (!opts.headers['content-type']) {
      opts.headers['content-type'] = 'text/plain;charset=UTF-8';
    }
  } else if (isPlainObject(opts.body)) {
    opts.body = JSON.stringify(opts.body);
    if (!opts.headers['content-type']) {
      opts.headers['content-type'] = 'application/json';
    }
  }
  if (!opts.headers.accept) {
    opts.headers.accept = '*/*';
  }
  if (opts.body == null && ['POST', 'PUT'].includes(opts.method)) {
    opts.headers['content-length'] = '0';
  }
  if (opts.compress && !opts.headers['accept-encoding']) {
    opts.headers['accept-encoding'] = 'gzip,deflate,br';
  }

  // extract optional abort signal
  const { signal } = opts;

  // delegate to protocol-specific request handler
  const { protocol, socket = null } = await determineProtocol(ctx, url, signal);
  debug(`${url.host} -> ${protocol}`);
  switch (protocol) {
    case ALPN_HTTP2:
      return h2.request(ctx, url, socket ? { ...opts, socket } : opts);
    case ALPN_HTTP2C:
      // plain-text HTTP/2 (h2c)
      // url.protocol = 'http:'; => doesn't work ?!
      return h2.request(
        ctx,
        new URL(`http://${url.host}${url.pathname}${url.hash}${url.search}`),
        socket ? { ...opts, socket } : opts,
      );
    case ALPN_HTTP1_0:
    case ALPN_HTTP1_1:
      return h1.request(ctx, url, socket ? { ...opts, socket } : opts);
    /* istanbul ignore next */
    default:
      // dead branch since; only here to make eslint stop complaining
      throw new TypeError(`unsupported protocol: ${protocol}`);
  }
};

const resetContext = async (ctx) => {
  ctx.alpnCache.reset();
  return Promise.all([
    h1.resetContext(ctx),
    h2.resetContext(ctx),
  ]);
};

const setupContext = (ctx) => {
  const {
    options: {
      alpnProtocols = ALPN_PROTOCOLS,
      alpnCacheTTL = ALPN_CACHE_TTL,
      alpnCacheSize = ALPN_CACHE_SIZE,
      userAgent = DEFAULT_USER_AGENT,
    },
  } = ctx;

  ctx.alpnProtocols = alpnProtocols;
  ctx.alpnCache = new LRU({ max: alpnCacheSize, maxAge: alpnCacheTTL });

  ctx.userAgent = userAgent;

  h1.setupContext(ctx);
  h2.setupContext(ctx);
};

module.exports = {
  request,
  setupContext,
  resetContext,
  RequestAbortedError,
  ALPN_HTTP2,
  ALPN_HTTP2C,
  ALPN_HTTP1_1,
  ALPN_HTTP1_0,
};
