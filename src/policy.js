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
const { Headers } = require('fetch-h2');

/**
 *
 * @param {Headers} headers
 * @returns {Object}
 */
const headersAsObject = (headers) => {
  const obj = {};
  for (const [key, value] of headers.entries()) {
    obj[key] = value;
  }
  return obj;
};

/**
 *
 * @param {Request} req
 * @returns {Object}
 */
const convertRequest = (req) => ({
  url: req.url,
  method: req.method,
  headers: headersAsObject(req.headers),
});

/**
 *
 * @param {Response} res
 * @returns {Object}
 */
const convertResponse = (res) => ({
  status: res.status,
  headers: headersAsObject(res.headers),
});

/**
 * Wrapper for CachePolicy, supporting Request and Response argument types
 * as specified by the Fetch API.
 */
class CachePolicyWrapper {
  /**
   *
   * @param {Request} req
   * @param {Response} res
   * @param {Object} options
   */
  constructor(req, res, options) {
    this.policy = new CachePolicy(convertRequest(req), convertResponse(res), options);
  }

  storable() {
    return this.policy.storable();
  }

  /**
   *
   * @param {Request} req
   * @returns boolean
   */
  satisfiesWithoutRevalidation(req) {
    return this.policy.satisfiesWithoutRevalidation(convertRequest(req));
  }

  /**
   *
   * @param {Response} res
   * @returns {Headers}
   */
  responseHeaders(res) {
    return new Headers(this.policy.responseHeaders(convertResponse(res)));
  }

  timeToLive() {
    return this.policy.timeToLive();
  }
/*
  age() {
    return this.policy.age();
  }

  maxAge() {
    return this.policy.maxAge();
  }

  stale() {
    return this.policy.stale();
  }

  revalidationHeaders(incomingReq) {
    return this.policy.revalidationHeaders(convertRequest(incomingReq));
  }

  revalidatedPolicy(request, response) {
    return this.policy.revalidatedPolicy(convertRequest(request), convertResponse(response));
  }
*/
}

module.exports = CachePolicyWrapper;
