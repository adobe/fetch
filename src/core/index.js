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

import debugFactory from 'debug';

import {
  request,
  setupContext,
  resetContext,
  RequestAbortedError,
  ALPN_HTTP2,
  ALPN_HTTP2C,
  ALPN_HTTP1_1,
  ALPN_HTTP1_0,
} from './request.js';

const debug = debugFactory('adobe/fetch:core');

class RequestContext {
  constructor(options) {
    // setup context
    this.options = { ...(options || {}) };
    setupContext(this);
  }

  /**
   * Returns the core API.
   */
  api() {
    return {
      /**
       * Requests a resource from the network. Returns a Promise which resolves once
       * the response is available.
       *
       * @param {string} url
       * @param {Object} options
       *
       * @throws RequestAbortedError if the request is aborted via an AbortSignal
       */
      request: async (url, options) => this.request(url, options),

      /**
       * This function returns an object which looks like the global `@adobe/fetch` API,
       * i.e. it will have the functions `request`, `reset`, etc. and provide its
       * own isolated caches.
       *
       * @param {Object} options
       */
      context: (options = {}) => new RequestContext(options).api(),

      /**
       * Resets the current context, i.e. disconnects all open/pending sessions, clears caches etc..
       */
      reset: async () => this.reset(),

      /**
       * Error thrown if a request is aborted via an AbortSignal.
       */
      RequestAbortedError,

      ALPN_HTTP2,
      ALPN_HTTP2C,
      ALPN_HTTP1_1,
      ALPN_HTTP1_0,
    };
  }

  async request(url, options) {
    return request(this, url, options);
  }

  async reset() {
    debug('resetting context');
    return resetContext(this);
  }
}

export default new RequestContext().api();
