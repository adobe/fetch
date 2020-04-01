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

const { EventEmitter } = require('events');

const {
  context,
  Request,
  TimeoutError,
} = require('fetch-h2');
const LRU = require('lru-cache');
const sizeof = require('object-sizeof');

const CachePolicy = require('./policy');
const { cacheableResponse, decoratedResponse } = require('./response');
const { decorateHeaders } = require('./headers');

const CACHEABLE_METHODS = ['GET', 'HEAD'];
const DEFAULT_FETCH_OPTIONS = { method: 'GET', cache: 'default' };
const DEFAULT_CONTEXT_OPTIONS = { userAgent: 'helix-fetch', overwriteUserAgent: true };
const DEFAULT_MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100mb

// events
const PUSH_EVENT = 'push';

/**
 * Cache the response as appropriate. The body stream of the
 * response is consumed & buffered to allow repeated reads.
 *
 * @param {Object} ctx context
 * @param {Request} request
 * @param {Response} response
 * @returns {Response} cached response with buffered body or original response if uncached.
 */
const cacheResponse = async (ctx, request, response) => {
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
    // (decorate original response providing the same extensions as the cacheable response)
    return decoratedResponse(response);
  }
};

function createPushHandler(ctx) {
  return async (origin, request, getResponse) => {
    // request.url is the relative URL for pushed resources => need to convert to absolute url
    const req = request.clone(new URL(request.url, origin).toString());
    // check if we've already cached the pushed resource
    const { policy } = ctx.cache.get(req.url) || {};
    if (!policy || !policy.satisfiesWithoutRevalidation(req)) {
      // consume pushed response
      const response = await getResponse();
      // update cache
      await cacheResponse(ctx, req, response);
    }
    ctx.eventEmitter.emit(PUSH_EVENT, req.url);
  };
}

function createUrl(url, qs = {}) {
  const urlWithQuery = new URL(url);
  if (typeof qs !== 'object' || Array.isArray(qs)) {
    throw new TypeError('qs: objet expected');
  }
  Object.entries(qs).forEach(([k, v]) => {
    if (Array.isArray(v)) {
      v.forEach((entry) => urlWithQuery.searchParams.append(k, entry));
    } else {
      urlWithQuery.searchParams.append(k, v);
    }
  });
  return urlWithQuery.href;
}

const wrappedFetch = async (ctx, url, options = {}) => {
  const opts = { ...DEFAULT_FETCH_OPTIONS, ...options };
  // sanitze method name (#24)
  if (typeof opts.method === 'string') {
    opts.method = opts.method.toUpperCase();
  }
  const lookupCache = CACHEABLE_METHODS.includes(opts.method)
    // respect cache mode (https://developer.mozilla.org/en-US/docs/Web/API/Request/cache)
    && !['no-store', 'reload'].includes(opts.cache);
  if (lookupCache) {
    // check cache
    const { policy, response } = ctx.cache.get(url) || {};
    // TODO: respect cache mode (https://developer.mozilla.org/en-US/docs/Web/API/Request/cache)
    if (policy && policy.satisfiesWithoutRevalidation(new Request(url, opts))) {
      // update headers of cached response: update age, remove uncacheable headers, etc.
      response.headers = decorateHeaders(policy.responseHeaders(response));

      // decorate response before delivering it (fromCache=true)
      const resp = response.clone();
      resp.fromCache = true;
      return resp;
    }
  }

  // fetch
  const fetchOptions = { ...opts, mode: 'no-cors', allowForbiddenHeaders: true };
  const request = new Request(url, fetchOptions);
  // workaround for https://github.com/grantila/fetch-h2/issues/84
  const response = await ctx.fetch(request, fetchOptions);

  return opts.cache !== 'no-store' ? cacheResponse(ctx, request, response) : decoratedResponse(response);
};

class FetchContext {
  constructor(options = {}) {
    // setup context
    const opts = { ...DEFAULT_CONTEXT_OPTIONS, ...options };
    this._ctx = context(opts);
    // setup cache
    const max = typeof opts.maxCacheSize === 'number' && opts.maxCacheSize >= 0 ? opts.maxCacheSize : DEFAULT_MAX_CACHE_SIZE;
    const length = ({ response }, _) => sizeof(response);
    this._ctx.cache = new LRU({ max, length });
    // event emitter
    this._ctx.eventEmitter = new EventEmitter();
    // register push handler
    this._ctx.onPush(createPushHandler(this._ctx));
  }

  /**
   * Returns the `helix-fetch` API.
   */
  api() {
    return {
      /**
       * Fetches a resource from the network or from the cache if the cached response
       * can be reused according to HTTP RFC 7234 rules. Returns a Promise which resolves once
       * the Response is available.
       *
       * @see https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch
       * @see https://httpwg.org/specs/rfc7234.html
       */
      fetch: async (url, options) => this.fetch(url, options),

      /**
       * This function returns an object which looks like the global `helix-fetch` API,
       * i.e. it will have the functions `fetch`, `disconnectAll`, etc. and provide its
       * own isolated cache.
       *
       * @param {Object} options
       */
      context: (options = {}) => this.context(options),

      /**
       * Disconnect all open/pending sessions.
       */
      disconnectAll: async () => this.disconnectAll(),

      /**
       * Register a callback which gets called once a server Push has been received.
       *
       * @param {Function} fn callback function invoked with the url of the pushed resource
       */
      onPush: (fn) => this.onPush(fn),

      /**
       * Deregister a callback previously registered with {#onPush}.
       *
       * @param {Function} fn callback function registered with {#onPush}
       */
      offPush: (fn) => this.offPush(fn),

      /**
       * Clear the cache entirely, throwing away all values.
       */
      clearCache: () => this.clearCache(),

      /**
       * Cache stats for diagnostic purposes
       */
      cacheStats: () => this.cacheStats(),

      /**
       * Error thrown when a request timed out.
       */
      TimeoutError,

      /**
       * Create a URL with query parameters
       *
       * @param {string} url request url
       * @param {object} [qs={}] request query parameters
       */
      createUrl,
    };
  }

  // eslint-disable-next-line class-methods-use-this
  context(options) {
    return new FetchContext(options).api();
  }

  disconnectAll() {
    this._ctx.disconnectAll();
  }

  onPush(fn) {
    return this._ctx.eventEmitter.on(PUSH_EVENT, fn);
  }

  offPush(fn) {
    return this._ctx.eventEmitter.off(PUSH_EVENT, fn);
  }

  clearCache() {
    this._ctx.cache.reset();
  }

  cacheStats() {
    return {
      size: this._ctx.cache.length,
      count: this._ctx.cache.itemCount,
    };
  }

  async fetch(url, options) {
    return wrappedFetch(this._ctx, url, options);
  }
}

module.exports = new FetchContext().api();
