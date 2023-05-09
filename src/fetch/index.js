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

import { EventEmitter } from 'events';
import { Readable } from 'stream';

import debugFactory from 'debug';
import { LRUCache } from 'lru-cache';

import { Body } from './body.js';
import Headers from './headers.js';
import Request from './request.js';
import Response from './response.js';
import { FetchBaseError, FetchError, AbortError } from './errors.js';
import { AbortController, AbortSignal, TimeoutSignal } from './abort.js';
import CachePolicy from './policy.js';
import cacheableResponse from './cacheableResponse.js';
import { sizeof } from '../common/utils.js';
import { isFormData } from '../common/formData.js';
// core abstraction layer
import core from '../core/index.js';

const { context, RequestAbortedError } = core;
const debug = debugFactory('adobe/fetch');

const CACHEABLE_METHODS = ['GET', 'HEAD'];
const DEFAULT_MAX_CACHE_ITEMS = 500;
const DEFAULT_MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100mb

// events
const PUSH_EVENT = 'push';

/**
 * Non-caching Fetch implementation
 *
 * @param {FetchContext} ctx
 * @param {string|Request} url
 * @param {Object} [options]
 */
const fetch = async (ctx, url, options) => {
  const { request } = ctx.context;

  const req = url instanceof Request && typeof options === 'undefined' ? url : /* c8 ignore next */ new Request(url, options);

  // extract options
  const {
    method, body, signal, compress, decode, follow, redirect, init: { body: initBody },
  } = req;

  let coreResp;

  if (signal && signal.aborted) {
    const err = new AbortError('The operation was aborted.');
    // cleanup request
    if (req.init.body instanceof Readable) {
      req.init.body.destroy(err);
    }
    throw err;
  }

  try {
    // call underlying protocol agnostic abstraction;
    // signal is passed to lower layer which throws a RequestAbortedError
    // if the signal fires
    coreResp = await request(req.url, {
      ...options,
      method,
      headers: req.headers.plain(),
      body: initBody && !(initBody instanceof Readable) && !isFormData(initBody) ? initBody : body,
      compress,
      decode,
      follow,
      redirect,
      signal,
    });
  } catch (err) {
    // cleanup request
    if (initBody instanceof Readable) {
      initBody.destroy(err);
    }
    /* c8 ignore next 3 */
    if (err instanceof TypeError) {
      throw err;
    }
    if (err instanceof RequestAbortedError) {
      throw new AbortError('The operation was aborted.');
    }
    // wrap system error in a FetchError instance
    throw new FetchError(err.message, 'system', err);
  }

  const abortHandler = () => {
    // deregister from signal
    signal.removeEventListener('abort', abortHandler);

    const err = new AbortError('The operation was aborted.');
    // cleanup request
    if (req.init.body instanceof Readable) {
      req.init.body.destroy(err);
    }
    // propagate error on response stream
    coreResp.readable.emit('error', err);
  };

  if (signal) {
    signal.addEventListener('abort', abortHandler);
  }

  const {
    statusCode,
    statusText,
    httpVersion,
    headers,
    readable,
    decoded,
  } = coreResp;

  // redirect?
  // https://fetch.spec.whatwg.org/#concept-http-fetch step 6
  if ([301, 302, 303, 307, 308].includes(statusCode)) {
    // https://fetch.spec.whatwg.org/#concept-http-fetch step 6.2
    const { location } = headers;
    // https://fetch.spec.whatwg.org/#concept-http-fetch step 6.3
    const locationURL = location == null ? null : new URL(location, req.url);
    // https://fetch.spec.whatwg.org/#concept-http-fetch step 6.5
    switch (req.redirect) {
      case 'manual':
        break;
      case 'error':
        if (signal) {
          // deregister from signal
          signal.removeEventListener('abort', abortHandler);
        }
        throw new FetchError(`uri requested responds with a redirect, redirect mode is set to 'error': ${req.url}`, 'no-redirect');
      case 'follow': {
        // https://fetch.spec.whatwg.org/#http-redirect-fetch step 2
        if (locationURL === null) {
          break;
        }

        // https://fetch.spec.whatwg.org/#http-redirect-fetch step 5
        if (req.counter >= req.follow) {
          if (signal) {
            // deregister from signal
            signal.removeEventListener('abort', abortHandler);
          }
          throw new FetchError(`maximum redirect reached at: ${req.url}`, 'max-redirect');
        }

        // https://fetch.spec.whatwg.org/#http-redirect-fetch step 6 (counter increment)
        // Create a new Request object.
        const requestOptions = {
          headers: new Headers(req.headers),
          follow: req.follow,
          compress: req.compress,
          decode: req.decode,
          counter: req.counter + 1,
          method: req.method,
          body: req.body,
          signal: req.signal,
        };

        // https://fetch.spec.whatwg.org/#http-redirect-fetch step 9
        if (statusCode !== 303 && req.body && req.init.body instanceof Readable) {
          if (signal) {
            // deregister from signal
            signal.removeEventListener('abort', abortHandler);
          }
          throw new FetchError('Cannot follow redirect with body being a readable stream', 'unsupported-redirect');
        }

        // https://fetch.spec.whatwg.org/#http-redirect-fetch step 11
        if (statusCode === 303 || ((statusCode === 301 || statusCode === 302) && req.method === 'POST')) {
          requestOptions.method = 'GET';
          requestOptions.body = undefined;
          requestOptions.headers.delete('content-length');
        }

        // https://fetch.spec.whatwg.org/#http-redirect-fetch step 15
        if (signal) {
          // deregister from signal
          signal.removeEventListener('abort', abortHandler);
        }
        return fetch(ctx, new Request(locationURL, requestOptions));
      }

      /* c8 ignore next */
      default:
        // fall through
    }
  }

  if (signal) {
    // deregister from signal once the response stream has ended or if there was an error
    readable.once('end', () => {
      signal.removeEventListener('abort', abortHandler);
    });
    readable.once('error', () => {
      signal.removeEventListener('abort', abortHandler);
    });
  }

  return new Response(
    readable,
    {
      url: req.url,
      status: statusCode,
      statusText,
      headers,
      httpVersion,
      decoded,
      counter: req.counter,
    },
  );
};

/**
 * Cache the response as appropriate. The body stream of the
 * response is consumed & buffered to allow repeated reads.
 *
 * @param {FetchContext} ctx context
 * @param {Request} request
 * @param {Response} response
 * @returns {Response} cached response with buffered body or original response if uncached.
 */
const cacheResponse = async (ctx, request, response) => {
  if (ctx.options.maxCacheSize === 0) {
    // caching is disabled: return original response
    return response;
  }
  if (!CACHEABLE_METHODS.includes(request.method)) {
    // return original un-cacheable response
    return response;
  }
  const policy = new CachePolicy(request, response, { shared: false });
  if (policy.storable()) {
    // update cache
    // create cacheable response (i.e. make it reusable)
    const cacheable = await cacheableResponse(response);
    ctx.cache.set(request.url, { policy, response: cacheable }, policy.timeToLive());
    return cacheable;
  } else {
    // return original un-cacheable response
    return response;
  }
};

/**
 * Caching Fetch implementation, wrapper for non-caching Fetch
 *
 * @param {FetchContext} ctx
 * @param {string|Request} url
 * @param {Object} [options]
 */
const cachingFetch = async (ctx, url, options) => {
  const req = new Request(url, options);

  const lookupCache = ctx.options.maxCacheSize !== 0 && CACHEABLE_METHODS.includes(req.method)
    // respect cache mode (https://developer.mozilla.org/en-US/docs/Web/API/Request/cache)
    && !['no-store', 'reload'].includes(req.cache);
  if (lookupCache) {
    // check cache
    const { policy, response } = ctx.cache.get(req.url) || {};
    // TODO: respect cache mode (https://developer.mozilla.org/en-US/docs/Web/API/Request/cache)
    if (policy && policy.satisfiesWithoutRevalidation(req)) {
      // update headers of cached response: update age, remove uncacheable headers, etc.
      response.headers = new Headers(policy.responseHeaders(response));

      // decorate response before delivering it (fromCache=true)
      const resp = response.clone();
      resp.fromCache = true;
      return resp;
    }
  }

  // fetch
  const resp = await fetch(ctx, req);
  return req.cache !== 'no-store' ? cacheResponse(ctx, req, resp) : resp;
};

const createUrl = (url, qs = {}) => {
  const urlWithQuery = new URL(url);
  if (typeof qs !== 'object' || Array.isArray(qs)) {
    throw new TypeError('qs: object expected');
  }
  Object.entries(qs).forEach(([k, v]) => {
    if (Array.isArray(v)) {
      v.forEach((entry) => urlWithQuery.searchParams.append(k, entry));
    } else {
      urlWithQuery.searchParams.append(k, v);
    }
  });
  return urlWithQuery.href;
};

/**
 * Creates a timeout signal which allows to specify
 * a timeout for a `fetch` call via the `signal` option.
 *
 * @param {number} ms timeout in milliseconds
 */
const timeoutSignal = (ms) => new TimeoutSignal(ms);

class FetchContext {
  constructor(options) {
    // setup context
    this.options = { ...options };
    // setup cache
    const { maxCacheSize } = this.options;
    let maxSize = typeof maxCacheSize === 'number' && maxCacheSize >= 0 ? maxCacheSize : DEFAULT_MAX_CACHE_SIZE;
    let max = DEFAULT_MAX_CACHE_ITEMS;
    if (maxSize === 0) {
      // we need to set a dummy value as LRUCache would translate a 0 to Infinity
      maxSize = 1;
      // no need to allocate memory if cache is disabled
      max = 1;
    }
    const sizeCalculation = ({ response }, _) => sizeof(response);
    this.cache = new LRUCache({ max, maxSize, sizeCalculation });
    // event emitter
    this.eventEmitter = new EventEmitter();

    this.options.h2 = this.options.h2 || {};
    if (typeof this.options.h2.enablePush === 'undefined') {
      this.options.h2.enablePush = true; // default
    }
    const { enablePush } = this.options.h2;
    if (enablePush) {
      // setup our pushPromiseHandler & pushHandler
      this.options.h2.pushPromiseHandler = (url, headers, reject) => {
        // strip HTTP/2 specific headers (:method, :authority, :path, :schema)
        const hdrs = { ...headers };
        Object.keys(hdrs)
          .filter((name) => name.startsWith(':'))
          .forEach((name) => delete hdrs[name]);
        this.pushPromiseHandler(url, hdrs, reject);
      };
      // core HTTP/2 push handler: need to wrap the response
      this.options.h2.pushHandler = (url, reqHeaders, response) => {
        // strip HTTP/2 specific headers (:method, :authority, :path, :schema)
        const hdrs = { ...reqHeaders };
        Object.keys(hdrs)
          .filter((name) => name.startsWith(':'))
          .forEach((name) => delete hdrs[name]);
        const {
          statusCode,
          statusText,
          httpVersion,
          headers,
          readable,
          decoded,
        } = response;
        this.pushHandler(
          url,
          hdrs,
          new Response(readable, {
            url,
            status: statusCode,
            statusText,
            headers,
            httpVersion,
            decoded,
          }),
        );
      };
    }

    this.context = context(this.options);
  }

  /**
   * Returns the Fetch API.
   */
  api() {
    return {
      /**
       * Fetches a resource from the network. Returns a Promise which resolves once
       * the response is available.
       *
       * @param {string|Request} url
       * @param {Object} [options]
       * @returns {Promise<Response>}
       * @throws FetchError
       * @throws AbortError
       * @throws TypeError
       */
      fetch: async (url, options) => this.fetch(url, options),

      Body,
      Headers,
      Request,
      Response,
      AbortController,
      AbortSignal,

      // non-spec extensions

      FetchBaseError,
      FetchError,
      AbortError,

      /**
       * This function returns an object which looks like the public API,
       * i.e. it will have the functions `fetch`, `context`, `reset`, etc. and provide its
       * own isolated caches and specific behavior according to `options`.
       *
       * @param {Object} options
       */
      context: (options = {}) => new FetchContext(options).api(),

      /**
       * Convenience function which creates a new context with disabled caching,
       * the equivalent of `context({ maxCacheSize: 0 })`.
       *
       * The optional `options` parameter allows to specify further options.
       *
       * @param {Object} [options={}]
       */
      noCache: (options = {}) => new FetchContext({ ...options, maxCacheSize: 0 }).api(),

      /**
       * Convenience function which creates a new context with enforced HTTP/1.1 protocol,
       * the equivalent of `context({ alpnProtocols: [ALPN_HTTP1_1] })`.
       *
       * The optional `options` parameter allows to specify further options.
       *
       * @param {Object} [options={}]
       */
      h1: (options = {}) => new FetchContext({
        ...options, alpnProtocols: [this.context.ALPN_HTTP1_1],
      }).api(),

      /**
       * Convenience function which creates a new context with enforced HTTP/1.1 protocol
       * and persistent connections (keep-alive), the equivalent of
       * `context({ alpnProtocols: [ALPN_HTTP1_1], h1: { keepAlive: true } })`.
       *
       * The optional `options` parameter allows to specify further options.
       *
       * @param {Object} [options={}]
       */
      keepAlive: (options = {}) => new FetchContext({
        ...options, alpnProtocols: [this.context.ALPN_HTTP1_1], h1: { keepAlive: true },
      }).api(),

      /**
       * Convenience function which creates a new context with disabled caching
       * and enforced HTTP/1.1 protocol, a combination of `h1()` and `noCache()`.
       *
       * The optional `options` parameter allows to specify further options.
       *
       * @param {Object} [options={}]
       */
      h1NoCache: (options = {}) => new FetchContext({
        ...options, maxCacheSize: 0, alpnProtocols: [this.context.ALPN_HTTP1_1],
      }).api(),

      /**
       * Convenience function which creates a new context with disabled caching
       * and enforced HTTP/1.1 protocol with persistent connections (keep-alive),
       * a combination of `keepAlive()` and `noCache()`.
       *
       * The optional `options` parameter allows to specify further options.
       *
       * @param {Object} [options={}]
       */
      keepAliveNoCache: (options = {}) => new FetchContext({
        ...options,
        maxCacheSize: 0,
        alpnProtocols: [this.context.ALPN_HTTP1_1],
        h1: { keepAlive: true },
      }).api(),

      /**
       * Resets the current context, i.e. disconnects all open/pending sessions, clears caches etc..
       */
      reset: async () => this.context.reset(),

      /**
       * Register a callback which gets called once a server Push has been received.
       *
       * @param {Function} fn callback function invoked with the url and the pushed Response
       */
      onPush: (fn) => this.onPush(fn),

      /**
       * Deregister a callback previously registered with {#onPush}.
       *
       * @param {Function} fn callback function registered with {#onPush}
       */
      offPush: (fn) => this.offPush(fn),

      /**
       * Create a URL with query parameters
       *
       * @param {string} url request url
       * @param {object} [qs={}] request query parameters
       */
      createUrl,

      /**
       * Creates a timeout signal which allows to specify
       * a timeout for a `fetch` operation via the `signal` option.
       *
       * @param {number} ms timeout in milliseconds
       */
      timeoutSignal,

      /**
       * Clear the cache entirely, throwing away all values.
       */
      clearCache: () => this.clearCache(),

      /**
       * Cache stats for diagnostic purposes
       */
      cacheStats: () => this.cacheStats(),

      /**
       * ALPN Constants
       */
      ALPN_HTTP2: this.context.ALPN_HTTP2,
      ALPN_HTTP2C: this.context.ALPN_HTTP2C,
      ALPN_HTTP1_1: this.context.ALPN_HTTP1_1,
      ALPN_HTTP1_0: this.context.ALPN_HTTP1_0,
    };
  }

  async fetch(url, options) {
    return cachingFetch(this, url, options);
  }

  onPush(fn) {
    return this.eventEmitter.on(PUSH_EVENT, fn);
  }

  offPush(fn) {
    return this.eventEmitter.off(PUSH_EVENT, fn);
  }

  clearCache() {
    this.cache.clear();
  }

  cacheStats() {
    return {
      size: this.cache.calculatedSize,
      count: this.cache.size,
    };
  }

  pushPromiseHandler(url, headers, reject) {
    debug(`received server push promise: ${url}, headers: ${JSON.stringify(headers)}`);
    const req = new Request(url, { headers });
    // check if we've already cached the pushed resource
    const { policy } = this.cache.get(url) || {};
    if (policy && policy.satisfiesWithoutRevalidation(req)) {
      debug(`already cached, reject push promise: ${url}, headers: ${JSON.stringify(headers)}`);
      // already cached and still valid, cancel push promise
      reject();
    }
  }

  async pushHandler(url, headers, response) {
    debug(`caching resource pushed by server: ${url}, reqHeaders: ${JSON.stringify(headers)}, status: ${response.status}, respHeaders: ${JSON.stringify(response.headers)}`);
    // cache pushed resource
    const cachedResponse = await cacheResponse(this, new Request(url, { headers }), response);
    this.eventEmitter.emit(PUSH_EVENT, url, cachedResponse);
  }
}

export default new FetchContext().api();
