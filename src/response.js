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

const { PassThrough } = require('stream');

const getStream = require('get-stream');

const { decorateHeaders } = require('./headers');

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
class CacheableResponse {
  /**
   * @param {Response} res
   */
  constructor(res) {
    this._res = res;
    this.headers = decorateHeaders(res.headers);
    this.ok = res.ok;
    this.status = res.status;
    this.statusText = res.statusText;
    this.redirected = res.redirected;
    this.type = res.type;
    this.url = res.url;
    this.httpVersion = res.httpVersion;
    this.bodyUsed = false;
    this._body = null;
  }

  async _ensureBodyConsumed() {
    if (!this._body) {
      this._body = await getStream.buffer(await this._res.readable());
    }
  }

  /**
   * Return a Node Readable stream.
   * (extension)
   */
  async readable() {
    await this._ensureBodyConsumed();
    const stream = new PassThrough();
    stream.end(this._body);
    return stream;
  }

  /**
   * Return a Node Buffer.
   * (extension)
   */
  async buffer() {
    await this._ensureBodyConsumed();
    return this._body;
  }

  async arrayBuffer() {
    await this._ensureBodyConsumed();
    return toArrayBuffer(this._body);
  }

  async text() {
    await this._ensureBodyConsumed();
    return this._body.toString();
  }

  async json() {
    return JSON.parse(await this.text());
  }

  /**
   * Create a shallow clone
   */
  clone() {
    return {
      ...this,
      readable: async () => this.readable(),
      text: async () => this.text(),
      json: async () => this.json(),
      arrayBuffer: async () => this.arrayBuffer(),
      buffer: async () => this.buffer(),
    };
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
  const cacheable = new CacheableResponse(res);
  // ensure body stream is fully read and buffered
  await cacheable.buffer();
  return cacheable;
};

/**
 * Decorates the Fetch API Response instance with the same extensions
 * as CacheableResponse but without interfering with/buffering the body.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Body
 *
 * @param {Response} res
 */
const decoratedResponse = async (res) => ({
  ...res,
  headers: decorateHeaders(res.headers),
  readable: async () => res.readable(),
  text: async () => res.text(),
  json: async () => res.json(),
  arrayBuffer: async () => res.arrayBuffer(),
  buffer: async () => getStream.buffer(await res.readable()),
});

module.exports = { cacheableResponse, decoratedResponse };
