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

const CachePolicy = require('http-cache-semantics');
const {
  setup,
  context,
  fetch,
  disconnect,
  disconnectAll,
  onPush,
  // Fetch API
  Body,
  Headers,
  Request,
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
} = require('fetch-h2');
const LRU = require('lru-cache');

const pushHandler = async (origin, request, getResponse) => {
//  if (shouldReceivePush(request)) {
      const response = await getResponse();
      // do something with response...
//  }
});


const ctx = context({
  userAgent: 'helix-fetch',
  overwriteUserAgent: true,
});

ctx.cache = LRU({ max: 500 });

const wrappedFetch = async (uri, options = { method: 'GET' }) => {
  // TODO lookup cache, cache result
  //ctx.cache.get

  options.mode = 'no-cors';
  options.allowForbiddenHeaders = true;
  const req = new Request(uri, options);
  const resp = await ctx.fetch(req);
  
  const policy = new CachePolicy(req, resp, {
    shared: true,
    cacheHeuristic: 0.1,
    immutableMinTimeToLive: 24 * 3600 * 1000, // 24h
    ignoreCargoCult: false,
    trustServerDate: true,
  });
  if (policy.storable()) {
    ctx.cache.set(req.url, { policy, resp }, policy.timeToLive());
  }

  return resp;
};

module.exports.fetch = wrappedFetch;
module.exports.disconnectAll = ctx.disconnectAll;
