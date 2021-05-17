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

const {
  // ClientHttp2Session,
  // ClientHttp2Stream,
  connect,
  constants,
  // IncomingHttpHeaders,
  // SecureClientSessionOptions,
} = require('http2');
const { Readable } = require('stream');

const debug = require('debug')('helix-fetch:h2');

const { RequestAbortedError } = require('./errors');
const { decodeStream } = require('../common/utils');

const { NGHTTP2_CANCEL } = constants;

const SESSION_IDLE_TIMEOUT = 5 * 60 * 1000; // 5m
const PUSHED_STREAM_IDLE_TIMEOUT = 5000; // 5s

const setupContext = (ctx) => {
  ctx.h2 = { sessionCache: {} };
};

// eslint-disable-next-line arrow-body-style
const resetContext = async ({ h2 }) => {
  return Promise.all(Object.values(h2.sessionCache).map(
    (session) => new Promise((resolve) => {
      session.on('close', resolve);
      debug(`resetContext: destroying session (socket #${session.socket && session.socket.id}, ${session.socket && session.socket.servername})`);
      session.destroy();
    }),
  ));
};

const createResponse = (
  headers, clientHttp2Stream, /* istanbul ignore next */ onError = () => {},
) => {
  const hdrs = { ...headers };
  const statusCode = hdrs[':status'];
  delete hdrs[':status'];

  return {
    statusCode,
    statusText: '',
    httpVersion: '2.0',
    httpVersionMajor: 2,
    httpVersionMinor: 0,
    headers: hdrs, // header names are always lower-cased
    readable: decodeStream(statusCode, headers, clientHttp2Stream, onError),
  };
};

const handlePush = (ctx, origin, pushedStream, requestHeaders, flags) => {
  const {
    options: {
      h2: {
        pushPromiseHandler,
        pushHandler,
        pushedStreamIdleTimeout = PUSHED_STREAM_IDLE_TIMEOUT,
      },
    },
  } = ctx;

  const path = requestHeaders[':path'];
  const url = `${origin}${path}`;

  debug(`received PUSH_PROMISE: ${url}, stream #${pushedStream.id}, headers: ${JSON.stringify(requestHeaders)}, flags: ${flags}`);
  if (pushPromiseHandler) {
    const rejectPush = () => {
      pushedStream.close(NGHTTP2_CANCEL);
    };
    // give handler opportunity to reject the push
    pushPromiseHandler(url, requestHeaders, rejectPush);
  }
  pushedStream.on('push', (responseHeaders, flgs) => {
    // received headers for the pushed streamn
    // similar to 'response' event on ClientHttp2Stream
    debug(`received push headers for ${origin}${path}, stream #${pushedStream.id}, headers: ${JSON.stringify(responseHeaders)}, flags: ${flgs}`);

    // set timeout to automatically discard pushed streams that aren't consumed for some time
    pushedStream.setTimeout(pushedStreamIdleTimeout, /* istanbul ignore next */ () => {
      debug(`closing pushed stream #${pushedStream.id} after ${pushedStreamIdleTimeout} ms of inactivity`);
      pushedStream.close(NGHTTP2_CANCEL);
    });

    /* istanbul ignore else */
    if (pushHandler) {
      pushHandler(url, requestHeaders, createResponse(responseHeaders, pushedStream));
    }
  });
  // log stream errors
  pushedStream.on('aborted', /* istanbul ignore next */ () => {
    debug(`pushed stream #${pushedStream.id} aborted`);
  });
  pushedStream.on('error', /* istanbul ignore next */ (err) => {
    debug(`pushed stream #${pushedStream.id} encountered error: ${err}`);
  });
  pushedStream.on('frameError', /* istanbul ignore next */ (type, code, id) => {
    debug(`pushed stream #${pushedStream.id} encountered frameError: type: ${type}, code: ${code}, id: ${id}`);
  });
};

const request = async (ctx, url, options) => {
  const {
    origin, pathname, search, hash,
  } = url;
  const path = `${pathname}${search}${hash}`;

  const {
    options: {
      h2: ctxOpts = {},
    },
    h2: {
      sessionCache,
    },
  } = ctx;
  const {
    idleSessionTimeout = SESSION_IDLE_TIMEOUT,
    pushPromiseHandler,
    pushHandler,
  } = ctxOpts;

  const opts = { ...options };
  const {
    method,
    headers,
    socket,
    body,
  } = opts;
  if (socket) {
    delete opts.socket;
  }
  /* istanbul ignore else */
  if (headers.host) {
    headers[':authority'] = headers.host;
    delete headers.host;
  }

  return new Promise((resolve, reject) => {
    // lookup session from session cache
    let session = sessionCache[origin];
    if (!session || session.closed || session.destroyed) {
      // connect and setup new session
      // (connect options: https://nodejs.org/api/http2.html#http2_http2_connect_authority_options_listener)
      const rejectUnauthorized = !((ctx.options.rejectUnauthorized === false
        || ctxOpts.rejectUnauthorized === false));
      const connectOptions = { ...ctxOpts, rejectUnauthorized };
      if (socket && !socket.inUse) {
        // we've got a socket from initial protocol negotiation via ALPN
        // reuse socket for new session
        connectOptions.createConnection = (/* url, options */) => {
          debug(`reusing socket #${socket.id} (${socket.servername})`);
          socket.inUse = true;
          return socket;
        };
      }

      const enablePush = !!(pushPromiseHandler || pushHandler);
      session = connect(origin, { ...connectOptions, settings: { enablePush } });
      session.setMaxListeners(1000);
      session.setTimeout(idleSessionTimeout, () => {
        debug(`closing session ${origin} after ${idleSessionTimeout} ms of inactivity`);
        session.close();
      });
      session.once('connect', () => {
        debug(`session ${origin} established`);
        debug(`caching session ${origin}`);
        sessionCache[origin] = session;
      });
      session.on('localSettings', (settings) => {
        debug(`session ${origin} localSettings: ${JSON.stringify(settings)}`);
      });
      session.on('remoteSettings', (settings) => {
        debug(`session ${origin} remoteSettings: ${JSON.stringify(settings)}`);
      });
      session.once('close', () => {
        debug(`session ${origin} closed`);
        /* istanbul ignore else */
        if (sessionCache[origin] === session) {
          debug(`discarding cached session ${origin}`);
          delete sessionCache[origin];
        }
      });
      session.once('error', /* istanbul ignore next */ (err) => {
        debug(`session ${origin} encountered error: ${err}`);
        if (sessionCache[origin] === session) {
          // FIXME: redundant because 'close' event will follow?
          debug(`discarding cached session ${origin}`);
          delete sessionCache[origin];
        }
      });
      session.on('frameError', /* istanbul ignore next */ (type, code, id) => {
        debug(`session ${origin} encountered frameError: type: ${type}, code: ${code}, id: ${id}`);
      });
      session.once('goaway', /* istanbul ignore next */ (errorCode, lastStreamID, opaqueData) => {
        debug(`session ${origin} received GOAWAY frame: errorCode: ${errorCode}, lastStreamID: ${lastStreamID}, opaqueData: ${opaqueData ? opaqueData.toString() : undefined}`);
        // session will be closed automatically
      });
      session.on('stream', (stream, hdrs, flags) => {
        handlePush(ctx, origin, stream, hdrs, flags);
      });
    } else {
      // we have a cached session
      /* istanbul ignore next */
      // eslint-disable-next-line no-lonely-if
      if (socket && socket.id !== session.socket.id && !socket.inUse) {
        // we have no use for the passed socket
        debug(`discarding redundant socket used for ALPN: #${socket.id} ${socket.servername}`);
        socket.destroy();
      }
    }

    debug(`${method} ${url.host}${path}`);
    let req;

    // intercept abort signal in order to cancel request
    const { signal } = opts;
    const onAbortSignal = () => {
      signal.removeEventListener('abort', onAbortSignal);
      reject(new RequestAbortedError());
      /* istanbul ignore else */
      if (req) {
        req.close(NGHTTP2_CANCEL);
      }
    };
    if (signal) {
      if (signal.aborted) {
        reject(new RequestAbortedError());
        return;
      }
      signal.addEventListener('abort', onAbortSignal);
    }

    const onSessionError = /* istanbul ignore next */ (err) => {
      debug(`session ${origin} encountered error during ${opts.method} ${url.href}: ${err}`);
      reject(err);
    };
    // listen on session errors during request
    session.once('error', onSessionError);

    req = session.request({ ':method': method, ':path': path, ...headers });
    req.once('response', (hdrs) => {
      session.off('error', onSessionError);
      if (signal) {
        signal.removeEventListener('abort', onAbortSignal);
      }
      resolve(createResponse(hdrs, req, reject));
    });
    req.once('error', (err) => {
      // error occured during the request
      session.off('error', onSessionError);
      /* istanbul ignore else */
      if (signal) {
        signal.removeEventListener('abort', onAbortSignal);
      }
      // if (!req.aborted) {
      /* istanbul ignore else */
      if (req.rstCode !== NGHTTP2_CANCEL) {
        debug(`${opts.method} ${url.href} failed with: ${err.message}`);
        req.close(NGHTTP2_CANCEL); // neccessary?
        reject(err);
      }
    });
    req.once('frameError', /* istanbul ignore next */ (type, code, id) => {
      session.off('error', onSessionError);
      debug(`encountered frameError during ${opts.method} ${url.href}: type: ${type}, code: ${code}, id: ${id}`);
    });
    req.on('push', /* istanbul ignore next */ (hdrs, flags) => {
      debug(`received 'push' event: headers: ${JSON.stringify(hdrs)}, flags: ${flags}`);
    });
    // send request body?
    if (body instanceof Readable) {
      body.pipe(req);
    } else {
      if (body) {
        req.write(body);
      }
      req.end();
    }
  });
};

module.exports = { request, setupContext, resetContext };
