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

const { pipeline } = require('stream');
const {
  createGunzip,
  createInflate,
  createBrotliDecompress,
  constants: {
    Z_SYNC_FLUSH,
  },
} = require('zlib');

const debug = require('debug')('helix-fetch:utils');

function shouldDecode(statusCode, headers) {
  if (statusCode === 204 || statusCode === 304) {
    return false;
  }
  if (+headers['content-length'] === 0) {
    return false;
  }
  return /^\s*(?:(x-)?deflate|(x-)?gzip|br)\s*$/.test(headers['content-encoding']);
}

function decodeStream(statusCode, headers, readableStream, onError) {
  if (!shouldDecode(statusCode, headers)) {
    return readableStream;
  }

  const cb = (err) => {
    if (err) {
      debug(`encountered error while decoding stream: ${err}`);
      onError(err);
    }
  };

  switch (headers['content-encoding'].trim()) {
    case 'gzip':
    case 'x-gzip':
      // use Z_SYNC_FLUSH like cURL does
      return pipeline(
        readableStream,
        createGunzip({ flush: Z_SYNC_FLUSH, finishFlush: Z_SYNC_FLUSH }),
        cb,
      );

    case 'deflate':
    case 'x-deflate':
      return pipeline(readableStream, createInflate(), cb);

    case 'br':
      return pipeline(readableStream, createBrotliDecompress(), cb);

    /* istanbul ignore next */
    default:
      // dead branch since it's covered by shouldDecode already;
      // only here to make eslint stop complaining
      return readableStream;
  }
}

function isPlainObject(val) {
  if (!val || typeof val !== 'object') {
    return false;
  }
  if (Object.prototype.toString.call(val) !== '[object Object]') {
    return false;
  }
  if (Object.getPrototypeOf(val) === null) {
    return true;
  }
  let proto = val;
  while (Object.getPrototypeOf(proto) !== null) {
    proto = Object.getPrototypeOf(proto);
  }
  return Object.getPrototypeOf(val) === proto;
}

module.exports = { decodeStream, isPlainObject };
