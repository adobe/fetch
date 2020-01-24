/*
 * Copyright 2019 Adobe. All rights reserved.
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
const { ResponseWrapper } = require('./response');

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
    // wrap response in order to make it reusable
    const wrappedResponse = new ResponseWrapper(response);
    // FIXME: ensure body stream is fully read and buffered
    await wrappedResponse.arrayBuffer();
    ctx.cache.set(request.url, { policy, response: wrappedResponse }, policy.timeToLive());
    return wrappedResponse;
  } else {
    // return original un-cacheable response
    return response;
  }
};

const pushHandler = async (origin, request, getResponse) => {
  // request.url is the relative URL for pushed resources => need to convert to absolute url
  const req = request.clone(new URL(request.url, origin).toString());
  // check if we've already cached the pushed resource
  const { policy } = ctx.cache.get(req.url) || {};
  if (!policy || !policy.satisfiesWithoutRevalidation(req)) {
    // consume pushed responsefewewfefw
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
      response.headers = policy.responseHeaders(response);

      return { ...response, fromCache: true };
    }
  }

  // fetch
  const request = new Request(url, { ...opts, mode: 'no-cors', allowForbiddenHeaders: true });
  const response = await ctx.fetch(request);

  return opts.cache !== 'no-store' ? cacheResponse(request, response) : response;
};

module.exports.fetch = wrappedFetch;
module.exports.onPush = (fn) => ctx.eventEmitter.on(PUSH_EVENT, fn);
module.exports.offPush = (fn) => ctx.eventEmitter.off(PUSH_EVENT, fn);
module.exports.clearCache = () => ctx.cache.reset();
// module.exports.disconnect = (url) => ctx.disconnect(url);
module.exports.disconnectAll = () => ctx.disconnectAll();
