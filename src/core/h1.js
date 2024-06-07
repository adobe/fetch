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

import http from 'http';
import https from 'https';
import { Readable } from 'stream';

import debugFactory from 'debug';

import { RequestAbortedError } from './errors.js';
import { decodeStream } from '../common/utils.js';

const debug = debugFactory('adobe/fetch:h1');

const getAgent = (ctx, protocol) => {
  // getAgent is synchronous, no need for lock/mutex
  const { h1, options: { h1: opts, rejectUnauthorized } } = ctx;

  if (protocol === 'https:') {
    // secure http
    if (h1.httpsAgent) {
      return h1.httpsAgent;
    }
    // use agent if either h1 options or rejectUnauthorized context option was specified
    if (opts || typeof rejectUnauthorized === 'boolean') {
      h1.httpsAgent = new https.Agent(typeof rejectUnauthorized === 'boolean' ? { ...(opts || {}), rejectUnauthorized } : opts);
      return h1.httpsAgent;
    }
    // use default (global) agent
    return undefined;
  } else {
    // plain http
    if (h1.httpAgent) {
      return h1.httpAgent;
    }
    if (opts) {
      h1.httpAgent = new http.Agent(opts);
      return h1.httpAgent;
    }
    // use default (global) agent
    return undefined;
  }
};

const setupContext = (ctx) => {
  // const { options: { h1: opts } } = ctx;
  ctx.h1 = {};
  // custom agents will be lazily instantiated
};

const resetContext = async ({ h1 }) => {
  if (h1.httpAgent) {
    debug('resetContext: destroying httpAgent');
    h1.httpAgent.destroy();
    // eslint-disable-next-line no-param-reassign
    delete h1.httpAgent;
  }
  if (h1.httpsAgent) {
    debug('resetContext: destroying httpsAgent');
    h1.httpsAgent.destroy();
    // eslint-disable-next-line no-param-reassign
    delete h1.httpsAgent;
  }
};

const createResponse = (incomingMessage, decode, onError) => {
  const {
    statusCode,
    statusMessage,
    httpVersion,
    httpVersionMajor,
    httpVersionMinor,
    headers, // header names are always lower-cased
  } = incomingMessage;
  const readable = decode
    ? decodeStream(statusCode, headers, incomingMessage, onError)
    : incomingMessage;
  const decoded = !!(decode && readable !== incomingMessage);
  return {
    statusCode,
    statusText: statusMessage,
    httpVersion,
    httpVersionMajor,
    httpVersionMinor,
    headers,
    readable,
    decoded,
  };
};

const h1Request = async (ctx, url, options) => {
  const { request } = url.protocol === 'https:' ? https : http;
  const agent = getAgent(ctx, url.protocol);
  const opts = { ...options, agent };
  const { socket, body } = opts;
  if (socket) {
    // we've got a socket from initial protocol negotiation via ALPN
    delete opts.socket;
    /* c8 ignore next 27 */
    if (!socket.assigned) {
      socket.assigned = true;
      // reuse socket for actual request
      if (agent) {
        // if there's an agent we need to override the agent's createConnection
        opts.agent = new Proxy(agent, {
          get: (target, property) => {
            if (property === 'createConnection' && !socket.inUse) {
              return (_connectOptions, cb) => {
                debug(`agent reusing socket #${socket.id} (${socket.servername})`);
                socket.inUse = true;
                cb(null, socket);
              };
            } else {
              return target[property];
            }
          },
        });
      } else {
        // no agent, provide createConnection function in options
        opts.createConnection = (_connectOptions, cb) => {
          debug(`reusing socket #${socket.id} (${socket.servername})`);
          socket.inUse = true;
          cb(null, socket);
        };
      }
    }
  }

  return new Promise((resolve, reject) => {
    debug(`${opts.method} ${url.href}`);
    let req;

    // intercept abort signal in order to cancel request
    const { signal } = opts;
    const onAbortSignal = () => {
      // deregister from signal
      signal.removeEventListener('abort', onAbortSignal);
      /* c8 ignore next 5 */
      if (socket && !socket.inUse) {
        // we have no use for the passed socket
        debug(`discarding redundant socket used for ALPN: #${socket.id} ${socket.servername}`);
        socket.destroy();
      }
      reject(new RequestAbortedError());
      if (req) {
        req.abort();
      }
    };
    if (signal) {
      if (signal.aborted) {
        reject(new RequestAbortedError());
        return;
      }
      signal.addEventListener('abort', onAbortSignal);
    }

    req = request(url, opts);
    req.once('response', (res) => {
      if (signal) {
        signal.removeEventListener('abort', onAbortSignal);
      }
      /* c8 ignore next 5 */
      if (socket && !socket.inUse) {
        // we have no use for the passed socket
        debug(`discarding redundant socket used for ALPN: #${socket.id} ${socket.servername}`);
        socket.destroy();
      }
      resolve(createResponse(res, opts.decode, reject));
    });
    req.once('error', (err) => {
      // error occured during the request
      if (signal) {
        signal.removeEventListener('abort', onAbortSignal);
      }
      /* c8 ignore next 5 */
      if (socket && !socket.inUse) {
        // we have no use for the passed socket
        debug(`discarding redundant socket used for ALPN: #${socket.id} ${socket.servername}`);
        socket.destroy();
      }
      /* c8 ignore next 6 */
      if (!req.aborted) {
        debug(`${opts.method} ${url.href} failed with: ${err.message}`);
        // TODO: better call req.destroy(err) instead of req.abort() ?
        req.abort();
        reject(err);
      }
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

export default { request: h1Request, setupContext, resetContext };
