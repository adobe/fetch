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

import { PassThrough, Readable } from 'stream';
import { types } from 'util';

import { FetchError, FetchBaseError } from './errors.js';
import { streamToBuffer } from '../common/utils.js';

const { isAnyArrayBuffer } = types;

const EMPTY_BUFFER = Buffer.alloc(0);
const INTERNALS = Symbol('Body internals');

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
 * Consume the body's stream and return a Buffer with the stream's content.
 *
 * Ref: https://fetch.spec.whatwg.org/#concept-body-consume-body
 *
 * @param {Body} body
 * @return Promise<Buffer>
 */
const consume = async (body) => {
  if (body[INTERNALS].disturbed) {
    throw new TypeError('Already read');
  }

  if (body[INTERNALS].error) {
    throw new TypeError(`Stream had error: ${body[INTERNALS].error.message}`);
  }

  // eslint-disable-next-line no-param-reassign
  body[INTERNALS].disturbed = true;

  const { stream } = body[INTERNALS];

  if (stream === null) {
    return EMPTY_BUFFER;
  }

  return streamToBuffer(stream);
};

/**
 * Body mixin
 *
 * @see https://fetch.spec.whatwg.org/#body
 */
class Body {
  /**
   * Constructs a new Body instance
   *
   * @constructor
   * @param {Readable|Buffer|String|URLSearchParams|FormData} [body] (see https://fetch.spec.whatwg.org/#bodyinit-unions)
   */
  constructor(body) {
    let stream;

    if (body == null) {
      stream = null;
    } else if (body instanceof URLSearchParams) {
      stream = Readable.from(body.toString());
    } else if (body instanceof Readable) {
      stream = body;
    } else if (Buffer.isBuffer(body)) {
      stream = Readable.from(body);
    } else if (isAnyArrayBuffer(body)) {
      stream = Readable.from(Buffer.from(body));
    } else if (typeof body === 'string' || body instanceof String) {
      stream = Readable.from(body);
    } else {
      // none of the above: coerce to string
      stream = Readable.from(String(body));
    }

    this[INTERNALS] = {
      stream,
      disturbed: false,
      error: null,
    };
    if (body instanceof Readable) {
      stream.on('error', (err) => {
        const error = err instanceof FetchBaseError
          ? err
          : new FetchError(`Invalid response body while trying to fetch ${this.url}: ${err.message}`, 'system', err);
        this[INTERNALS].error = error;
      });
    }
  }

  /**
   * Return a Node.js Readable stream.
   * (deviation from spec)
   *
   * @return {Readable}
   */
  get body() {
    return this[INTERNALS].stream;
  }

  get bodyUsed() {
    return this[INTERNALS].disturbed;
  }

  /**
   * Consume the body and return a promise that will resolve to a Node.js Buffer.
   * (non-spec extension)
   *
   * @return {Promise<Buffer>}
   */
  async buffer() {
    return consume(this);
  }

  /**
   * Consume the body and return a promise that will resolve to an ArrayBuffer.
   *
   * @return {Promise<ArrayBuffer>}
   */
  async arrayBuffer() {
    return toArrayBuffer(await this.buffer());
  }

  /**
   * Consume the body and return a promise that will resolve to a String.
   *
   * @return {Promise<String>}
   */
  async text() {
    const buf = await consume(this);
    return buf.toString();
  }

  /**
   * Consume the body and return a promise that will
   * resolve to the result of JSON.parse(responseText).
   *
   * @return {Promise<*>}
   */
  async json() {
    return JSON.parse(await this.text());
  }
}

Object.defineProperties(Body.prototype, {
  body: { enumerable: true },
  bodyUsed: { enumerable: true },
  arrayBuffer: { enumerable: true },
  json: { enumerable: true },
  text: { enumerable: true },
});

/**
 * Clone the body's stream.
 *
 * @param {Body} body
 * @return {Readable}
 */
const cloneStream = (body) => {
  if (body[INTERNALS].disturbed) {
    throw new TypeError('Cannot clone: already read');
  }

  const { stream } = body[INTERNALS];
  let result = stream;

  if (stream instanceof Readable) {
    result = new PassThrough();
    const clonedStream = new PassThrough();
    stream.pipe(result);
    stream.pipe(clonedStream);
    // set body's stream to cloned stream and return result (i.e. the other clone)
    // eslint-disable-next-line no-param-reassign
    body[INTERNALS].stream = clonedStream;
  }
  return result;
};

/**
 * Guesses the `Content-Type` based on the type of body.
 *
 * @param {Readable|Buffer|String|URLSearchParams|FormData} body Any options.body input
 * @returns {string|null}
 */
const guessContentType = (body) => {
  if (body === null) {
    return null;
  }

  if (typeof body === 'string') {
    return 'text/plain; charset=utf-8';
  }

  if (body instanceof URLSearchParams) {
    return 'application/x-www-form-urlencoded; charset=utf-8';
  }

  if (Buffer.isBuffer(body)) {
    return null;
  }

  if (isAnyArrayBuffer(body)) {
    return null;
  }

  if (body instanceof Readable) {
    return null;
  }

  // fallback: body is coerced to string
  return 'text/plain; charset=utf-8';
};

export {
  Body,
  cloneStream,
  guessContentType,
};
