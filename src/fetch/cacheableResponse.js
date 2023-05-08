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

/* eslint-disable max-classes-per-file */

import { Readable } from 'stream';

import Headers from './headers.js';
import Response from './response.js';

const INTERNALS = Symbol('CacheableResponse internals');

/**
 * Convert a NodeJS Buffer to an ArrayBuffer
 *
 * @see https://stackoverflow.com/a/31394257
 *
 * @param {Buffer} buf
 * @returns {ArrayBuffer}
 */
const toArrayBuffer = (buf) => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

/**
 * Wrapper for the Fetch API Response class, providing support for buffering
 * the body stream and thus allowing repeated reads of the body.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Response
 */
class CacheableResponse extends Response {
  /**
   * Constructs a new Response instance
   *
   * @constructor
   * @param {Buffer} body
   * @param {Object} [init]
   */
  constructor(body, init) {
    super(body, init);

    const headers = new Headers(init.headers);

    this[INTERNALS] = {
      headers,
      bufferedBody: body,
    };
  }

  get headers() {
    return this[INTERNALS].headers;
  }

  set headers(headers) {
    if (headers instanceof Headers) {
      this[INTERNALS].headers = headers;
    } else {
      throw new TypeError('instance of Headers expected');
    }
  }

  get body() {
    return Readable.from(this[INTERNALS].bufferedBody);
  }

  // eslint-disable-next-line class-methods-use-this
  get bodyUsed() {
    return false;
  }

  async buffer() {
    return this[INTERNALS].bufferedBody;
  }

  async arrayBuffer() {
    return toArrayBuffer(this[INTERNALS].bufferedBody);
  }

  async text() {
    return this[INTERNALS].bufferedBody.toString();
  }

  async json() {
    return JSON.parse(await this.text());
  }

  clone() {
    const {
      url, status, statusText, headers, httpVersion, decoded, counter,
    } = this;
    return new CacheableResponse(
      this[INTERNALS].bufferedBody,
      {
        url, status, statusText, headers, httpVersion, decoded, counter,
      },
    );
  }

  get [Symbol.toStringTag]() {
    return this.constructor.name;
  }
}

/**
 * Creates a cacheable response.
 *
 * According to the Fetch API the body of a response can be read only once.
 * In order to allow caching we need to serialize the body into a buffer first.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Body
 *
 * @param {Response} res
 */
const cacheableResponse = async (res) => {
  const buf = await res.buffer();
  const {
    url, status, statusText, headers, httpVersion, decoded, redirected,
  } = res;
  return new CacheableResponse(
    buf,
    {
      url, status, statusText, headers, httpVersion, decoded, counter: redirected ? 1 : 0,
    },
  );
};

export default cacheableResponse;
