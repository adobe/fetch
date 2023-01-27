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

import { AbortSignal } from './abort.js';
import { Body, cloneStream, guessContentType } from './body.js';
import Headers from './headers.js';
import { isPlainObject } from '../common/utils.js';
import { isFormData, FormDataSerializer } from '../common/formData.js';

const DEFAULT_FOLLOW = 20;

const INTERNALS = Symbol('Request internals');

/**
 * Request class
 *
 * @see https://fetch.spec.whatwg.org/#request-class
 */
class Request extends Body {
  /**
   * Constructs a new Request instance
   *
   * @constructor
   * @param {Request|String} input
   * @param {Object} [init={}]
   */
  constructor(input, init = {}) {
    // normalize input
    const req = input instanceof Request ? input : null;
    const parsedURL = req ? new URL(req.url) : new URL(input);

    let method = init.method || (req && req.method) || 'GET';
    method = method.toUpperCase();

    // eslint-disable-next-line no-eq-null, eqeqeq
    if ((init.body != null // neither null nor undefined
      || (req && req.body !== null))
      && ['GET', 'HEAD'].includes(method)) {
      throw new TypeError('Request with GET/HEAD method cannot have body');
    }

    let body = init.body || (req && req.body ? cloneStream(req) : null);
    const headers = new Headers(init.headers || (req && req.headers) || {});

    if (isFormData(body)) {
      // spec-compliant FormData
      if (!headers.has('content-type')) {
        const fd = new FormDataSerializer(body);
        body = fd.stream();
        headers.set('content-type', fd.contentType());
        if (!headers.has('transfer-encoding')
          && !headers.has('content-length')) {
          headers.set('content-length', fd.length());
        }
      }
    }

    if (!headers.has('content-type')) {
      if (isPlainObject(body)) {
        // non-spec extension: support plain js object body (JSON serialization)
        body = JSON.stringify(body);
        headers.set('content-type', 'application/json');
      } else {
        const contentType = guessContentType(body);
        if (contentType) {
          headers.set('content-type', contentType);
        }
      }
    }

    // call Body constructor
    super(body);

    let signal = req ? req.signal : null;
    if ('signal' in init) {
      signal = init.signal;
    }

    if (signal && !(signal instanceof AbortSignal)) {
      throw new TypeError('signal needs to be an instance of AbortSignal');
    }

    const redirect = init.redirect || (req && req.redirect) || 'follow';
    if (!['follow', 'error', 'manual'].includes(redirect)) {
      throw new TypeError(`'${redirect}' is not a valid redirect option`);
    }

    const cache = init.cache || (req && req.cache) || 'default';
    if (!['default', 'no-store', 'reload', 'no-cache', 'force-cache', 'only-if-cached'].includes(cache)) {
      throw new TypeError(`'${cache}' is not a valid cache option`);
    }

    this[INTERNALS] = {
      init: { ...init },
      method,
      redirect,
      cache,
      headers,
      parsedURL,
      signal,
    };

    // non-spec extension options
    if (init.follow === undefined) {
      if (!req || req.follow === undefined) {
        this.follow = DEFAULT_FOLLOW;
      } else {
        this.follow = req.follow;
      }
    } else {
      this.follow = init.follow;
    }
    this.counter = init.counter || (req && req.counter) || 0;
    if (init.compress === undefined) {
      if (!req || req.compress === undefined) {
        // default
        this.compress = true;
      } else {
        this.compress = req.compress;
      }
    } else {
      this.compress = init.compress;
    }
    if (init.decode === undefined) {
      if (!req || req.decode === undefined) {
        // default
        this.decode = true;
      } else {
        this.decode = req.decode;
      }
    } else {
      this.decode = init.decode;
    }
  }

  get method() {
    return this[INTERNALS].method;
  }

  get url() {
    return this[INTERNALS].parsedURL.toString();
  }

  get headers() {
    return this[INTERNALS].headers;
  }

  get redirect() {
    return this[INTERNALS].redirect;
  }

  get cache() {
    return this[INTERNALS].cache;
  }

  get signal() {
    return this[INTERNALS].signal;
  }

  /**
   * Clone this request
   *
   * @return {Request}
   */
  clone() {
    return new Request(this);
  }

  get init() {
    return this[INTERNALS].init;
  }

  get [Symbol.toStringTag]() {
    return this.constructor.name;
  }
}

Object.defineProperties(Request.prototype, {
  method: { enumerable: true },
  url: { enumerable: true },
  headers: { enumerable: true },
  redirect: { enumerable: true },
  cache: { enumerable: true },
  clone: { enumerable: true },
  signal: { enumerable: true },
});

export default Request;
