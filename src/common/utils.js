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

/* eslint-disable guard-for-in */
import { constants as bufferConstants } from 'buffer';
import { pipeline, PassThrough } from 'stream';
import { promisify } from 'util';
import {
  createGunzip, createInflate, createBrotliDecompress, constants as zlibConstants,
} from 'zlib';
import debugFactory from 'debug';

const debug = debugFactory('adobe/fetch:utils');
const { MAX_LENGTH: maxBufferLength } = bufferConstants;
const { Z_SYNC_FLUSH } = zlibConstants;

const asyncPipeline = promisify(pipeline);

const canDecode = (statusCode, headers) => {
  if (statusCode === 204 || statusCode === 304) {
    return false;
  }
  if (+headers['content-length'] === 0) {
    return false;
  }
  return /^\s*(?:(x-)?deflate|(x-)?gzip|br)\s*$/.test(headers['content-encoding']);
};

const decodeStream = (statusCode, headers, readableStream, onError) => {
  if (!canDecode(statusCode, headers)) {
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

    /* c8 ignore next 4 */
    default:
      // dead branch since it's covered by shouldDecode already;
      // only here to make eslint stop complaining
      return readableStream;
  }
};

const isPlainObject = (val) => {
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
};

const calcSize = (obj, processed) => {
  if (Buffer.isBuffer(obj)) {
    return obj.length;
  }

  switch (typeof obj) {
    case 'string':
      return obj.length * 2;
    case 'boolean':
      return 4;
    case 'number':
      return 8;
    case 'symbol':
      return Symbol.keyFor(obj)
        ? Symbol.keyFor(obj).length * 2 // global symbol '<string>'
        : (obj.toString().length - 8) * 2; // local symbol 'Symbol(<string>)'
    case 'object':
      if (Array.isArray(obj)) {
        // eslint-disable-next-line no-use-before-define
        return calcArraySize(obj, processed);
      } else {
        // eslint-disable-next-line no-use-before-define
        return calcObjectSize(obj, processed);
      }
    default:
      return 0;
  }
};

const calcArraySize = (arr, processed) => {
  processed.add(arr);

  return arr.map((entry) => {
    if (processed.has(entry)) {
      // skip circular references
      return 0;
    }
    return calcSize(entry, processed);
  }).reduce((acc, curr) => acc + curr, 0);
};

const calcObjectSize = (obj, processed) => {
  if (obj == null) {
    return 0;
  }

  processed.add(obj);

  let bytes = 0;
  const names = [];

  // eslint-disable-next-line no-restricted-syntax
  for (const key in obj) {
    names.push(key);
  }

  names.push(...Object.getOwnPropertySymbols(obj));

  names.forEach((nm) => {
    // key
    bytes += calcSize(nm, processed);
    // value
    if (typeof obj[nm] === 'object' && obj[nm] !== null) {
      if (processed.has(obj[nm])) {
        // skip circular references
        return;
      }
      processed.add(obj[nm]);
    }
    bytes += calcSize(obj[nm], processed);
  });

  return bytes;
};

const sizeof = (obj) => calcSize(obj, new WeakSet());

const streamToBuffer = async (stream) => {
  const passThroughStream = new PassThrough();

  let length = 0;
  const chunks = [];

  passThroughStream.on('data', (chunk) => {
    /* c8 ignore next 3 */
    if ((length + chunk.length) > maxBufferLength) {
      throw new Error('Buffer.constants.MAX_SIZE exceeded');
    }
    chunks.push(chunk);
    length += chunk.length;
  });

  await asyncPipeline(stream, passThroughStream);
  return Buffer.concat(chunks, length);
};

export {
  decodeStream, isPlainObject, sizeof, streamToBuffer,
};
