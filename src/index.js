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
/*
  setup,
  fetch,
  disconnect,
  disconnectAll,
  onPush,
  // Fetch API
  Body,
  Headers,
  Response,

  AbortError,
  AbortController,
  TimeoutError,

  ContextOptions,
  DecodeFunction,
  Decoder,

  CookieJar,

  // TypeScript types:
  OnTrailers,
*/
} = require('fetch-h2');
const LRU = require('lru-cache');

const CachePolicy = require('./policy');

const CACHEABLE_METHODS = ['GET', 'HEAD'];

const ctx = context({
  userAgent: 'helix-fetch',
  overwriteUserAgent: true,
});

ctx.cache = new LRU({ max: 500 });

/**
 * Cache the response as appropriate
 *
 * @param {Request} request
 * @param {Response} response
 */
const cacheResponse = async (request, response) => {
  if (!CACHEABLE_METHODS.includes(request.method)) {
    return;
  }
  const policy = new CachePolicy(request, response, { shared: false });
  if (policy.storable()) {
    // update cache
    // TODO: need to fully consume body stream first?
    ctx.cache.set(request.uri, { policy, response }, policy.timeToLive());
  }
};

const pushHandler = async (origin, request, getResponse) => {
  // check if we've already cached the pushed resource
  const { policy } = ctx.cache.get(request.uri) || {};
  if (!policy || policy.satisfiesWithoutRevalidation(request)) {
    // consume pushed response
    const response = await getResponse();
    // update cache
    // TODO: need to fully consume body stream first?
    await cacheResponse(request, response);
  }
};

// register push handler
ctx.onPush(pushHandler);

const wrappedFetch = async (uri, options = { method: 'GET', cache: 'default' }) => {
  const lookupCache = CACHEABLE_METHODS.includes(options.method)
    // respect cache mode (https://developer.mozilla.org/en-US/docs/Web/API/Request/cache)
    && !['no-store', 'reload'].includes(options.cache);
  if (lookupCache) {
    // check cache
    const { policy, response } = ctx.cache.get(uri) || {};
    if (policy && policy.satisfiesWithoutRevalidation(new Request(uri, options))) {
      // response headers have to be updated, e.g. to add Age and remove uncacheable headers.
      response.headers = policy.responseHeaders();
      return response;
    }
  }

  // fetch
  const opts = { ...options };
  opts.mode = 'no-cors';
  opts.allowForbiddenHeaders = true;
  const request = new Request(uri, opts);
  const response = await ctx.fetch(request);

  if (options.cache !== 'no-store') {
    await cacheResponse(request, response);
  }
  return response;
};

module.exports.fetch = wrappedFetch;
module.exports.disconnectAll = ctx.disconnectAll;
