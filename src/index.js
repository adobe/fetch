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

const {
  context,
  Request,
} = require('fetch-h2');
const LRU = require('lru-cache');

const CachePolicy = require('./policy');
const { ResponseWrapper } = require('./response');

const CACHEABLE_METHODS = ['GET', 'HEAD'];

const ctx = context({
  userAgent: 'helix-fetch',
  overwriteUserAgent: true,
});

ctx.cache = new LRU({ max: 500 });

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
    // wrap response in order to make it re-readable
    const wrappedResponse = new ResponseWrapper(response);
    // FIXME: ensure body stream is fully read and bufferd
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
    // consume pushed response
    const response = await getResponse();
    // update cache
    await cacheResponse(req, response);
  /*
    console.log(`accepted pushed resource: ${req.url}`);
  } else {
    console.log(`declined pushed resource: ${req.url}`);
  */
  }
};

// register push handler
ctx.onPush(pushHandler);

const wrappedFetch = async (url, options = { method: 'GET', cache: 'default' }) => {
  const lookupCache = CACHEABLE_METHODS.includes(options.method)
    // respect cache mode (https://developer.mozilla.org/en-US/docs/Web/API/Request/cache)
    && !['no-store', 'reload'].includes(options.cache);
  if (lookupCache) {
    // check cache
    const { policy, response } = ctx.cache.get(url) || {};
    if (policy && policy.satisfiesWithoutRevalidation(new Request(url, options))) {
      // response headers need to be updated, e.g. to add Age and remove uncacheable headers.
      return { ...response, headers: policy.responseHeaders(), fromCache: true };
    }
  }

  // fetch
  const request = new Request(url, { ...options, mode: 'no-cors', allowForbiddenHeaders: true });
  const response = await ctx.fetch(request);

  return options.cache !== 'no-store' ? cacheResponse(request, response) : response;
};

module.exports.fetch = wrappedFetch;
module.exports.disconnect = (url) => ctx.disconnect(url);
module.exports.disconnectAll = () => ctx.disconnectAll();
