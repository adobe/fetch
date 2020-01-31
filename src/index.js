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
} = require('fetch-h2');
const LRU = require('lru-cache');

const CachePolicy = require('./policy');
const { cacheableResponse, decoratedResponse } = require('./response');
const { decorateHeaders } = require('./headers');

const CACHEABLE_METHODS = ['GET', 'HEAD'];
const DEFAULT_FETCH_OPTIONS = { method: 'GET', cache: 'default' };

// events
const PUSH_EVENT = 'push';

const ctx = context({
  userAgent: 'helix-fetch',
  overwriteUserAgent: true,
});

ctx.cache = new LRU({ max: 500 });
ctx.eventEmitter = new EventEmitter();

/**
 * Cache the response as appropriate. The body stream of the
 * response is consumed & buffered to allow repeated reads.
 *
 * @param {Request} request
 * @param {Response} response
 * @returns {Response} cached response with buffered body or original response if uncached.
 */
const cacheResponse = async (request, response) => {
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

const pushHandler = async (origin, request, getResponse) => {
  // request.url is the relative URL for pushed resources => need to convert to absolute url
  const req = request.clone(new URL(request.url, origin).toString());
  // check if we've already cached the pushed resource
  const { policy } = ctx.cache.get(req.url) || {};
  if (!policy || !policy.satisfiesWithoutRevalidation(req)) {
    // consume pushed response
    const response = await getResponse();
    // update cache
    await cacheResponse(req, response);
  }
  ctx.eventEmitter.emit(PUSH_EVENT, req.url);
};

// register push handler
ctx.onPush(pushHandler);

const wrappedFetch = async (url, options = DEFAULT_FETCH_OPTIONS) => {
  const opts = { ...DEFAULT_FETCH_OPTIONS, ...options };
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
  const request = new Request(url, { ...opts, mode: 'no-cors', allowForbiddenHeaders: true });
  const response = await ctx.fetch(request);

  return opts.cache !== 'no-store' ? cacheResponse(request, response) : decoratedResponse(response);
};

/**
 * Fetches a resource from the network or from the cache if the cached response
 * can be reused according to HTTP RFC 7234 rules. Returns a Promise which resolves once
 * the Response is available.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch
 * @see https://httpwg.org/specs/rfc7234.html
 */
module.exports.fetch = wrappedFetch;
/**
 * Register a callback which gets called once a server Push has been received.
 *
 * @param {Function} fn callback function invoked with the url of the pushed resource
 */
module.exports.onPush = (fn) => ctx.eventEmitter.on(PUSH_EVENT, fn);
/**
 * Deregister a callback previously registered with {#onPush}.
 *
 * @param {Function} fn callback function registered with {#onPush}
 */
module.exports.offPush = (fn) => ctx.eventEmitter.off(PUSH_EVENT, fn);
/**
 * Clears the cache i.e. removes all entries.
 */
module.exports.clearCache = () => ctx.cache.reset();
/**
 * Disconnect all open/pending sessions.
 */
module.exports.disconnectAll = () => ctx.disconnectAll();
// module.exports.disconnect = (url) => ctx.disconnect(url);
