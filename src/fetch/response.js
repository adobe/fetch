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

const { Body, cloneStream } = require('./body');
const { Headers } = require('./headers');

const INTERNALS = Symbol('Response internals');

/**
 * Response class
 *
 * @see https://fetch.spec.whatwg.org/#response-class
 */
class Response extends Body {
  /**
   * Constructs a new Response instance
   *
   * @constructor
   * @param {Readable|Buffer|String|URLSearchParams} [body=null] (see https://fetch.spec.whatwg.org/#bodyinit-unions)
   * @param {Object} [init={}]
   */
  constructor(body = null, init = {}) {
    super(body);

    const headers = new Headers(init.headers);

    this[INTERNALS] = {
      url: init.url,
      status: init.status || 200,
      statusText: init.statusText || '',
      headers,
      httpVersion: init.httpVersion,
      counter: init.counter,
    };
  }

  get url() {
    return this[INTERNALS].url || '';
  }

  get status() {
    return this[INTERNALS].status;
  }

  get statusText() {
    return this[INTERNALS].statusText;
  }

  get ok() {
    return this[INTERNALS].status >= 200 && this[INTERNALS].status < 300;
  }

  get redirected() {
    return this[INTERNALS].counter > 0;
  }

  get headers() {
    return this[INTERNALS].headers;
  }

  // extension
  get httpVersion() {
    return this[INTERNALS].httpVersion;
  }

  /**
   * Create a redirect response.
   *
   * @param {string} url The URL that the new response is to originate from.
   * @param {number} [status=302] An optional status code for the response (default: 302)
   * @returns {Response} A Response object.
   *
   * See https://fetch.spec.whatwg.org/#dom-response-redirect
   */
  static redirect(url, status = 302) {
    if (![301, 302, 303, 307, 308].includes(status)) {
      throw new RangeError('Invalid status code');
    }

    return new Response(null, {
      headers: {
        location: new URL(url).toString(),
      },
      status,
    });
  }

  /**
   * Clone this response
   *
   * @returns {Response}
   */
  clone() {
    if (this.bodyUsed) {
      throw new TypeError('Cannot clone: already read');
    }

    return new Response(cloneStream(this), { ...this[INTERNALS] });
  }

  get [Symbol.toStringTag]() {
    return this.constructor.name;
  }
}

Object.defineProperties(Response.prototype, {
  url: { enumerable: true },
  status: { enumerable: true },
  ok: { enumerable: true },
  redirected: { enumerable: true },
  statusText: { enumerable: true },
  headers: { enumerable: true },
  clone: { enumerable: true },
});

module.exports = {
  Response,
};
