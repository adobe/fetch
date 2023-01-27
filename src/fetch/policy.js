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

import CachePolicy from 'http-cache-semantics';

import Headers from './headers.js';

/**
 *
 * @param {Request} req
 * @returns {Object}
 */
const convertRequest = (req) => ({
  url: req.url,
  method: req.method,
  headers: req.headers.plain(),
});

/**
 *
 * @param {Response} res
 * @returns {Object}
 */
const convertResponse = (res) => ({
  status: res.status,
  headers: res.headers.plain(),
});

/**
 * Wrapper for CachePolicy, supporting Request and Response argument types
 * as specified by the Fetch API.
 *
 * @class
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
 * @see https://github.com/kornelski/http-cache-semantics
 */
class CachePolicyWrapper {
  /**
   * Creates a new CachePolicyWrapper instance.
   *
   * @see https://github.com/kornelski/http-cache-semantics#constructor-options
   *
   * @constructor
   * @param {Request} req
   * @param {Response} res
   * @param {Object} options
   */
  constructor(req, res, options) {
    this.policy = new CachePolicy(convertRequest(req), convertResponse(res), options);
  }

  /**
   * @see https://github.com/kornelski/http-cache-semantics#storable
   */
  storable() {
    return this.policy.storable();
  }

  /**
   * @see https://github.com/kornelski/http-cache-semantics#satisfieswithoutrevalidationnewrequest
   *
   * @param {Request} req
   * @returns boolean
   */
  satisfiesWithoutRevalidation(req) {
    return this.policy.satisfiesWithoutRevalidation(convertRequest(req));
  }

  /**
   * @see https://github.com/kornelski/http-cache-semantics#responseheaders
   *
   * @param {Response} res
   * @returns {Headers}
   */
  responseHeaders(res) {
    return new Headers(this.policy.responseHeaders(convertResponse(res)));
  }

  /**
   * @see https://github.com/kornelski/http-cache-semantics#timetolive
   */
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

export default CachePolicyWrapper;
