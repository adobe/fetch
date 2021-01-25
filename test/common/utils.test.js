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

/* eslint-env mocha */

'use strict';

const assert = require('assert');
const { Readable } = require('stream');
const { promisify } = require('util');
const zlib = require('zlib');

const getStream = require('get-stream');
const sinon = require('sinon');

const { decodeStream, isPlainObject } = require('../../src/common/utils');

const gzip = promisify(zlib.gzip);
const deflate = promisify(zlib.deflate);
const brotliCompress = promisify(zlib.brotliCompress);

const TEST_DATA = Buffer.from('hello, world!', 'utf8');

describe('isPlainObject Tests', () => {
  it('isPlainObject works', () => {
    // plain object
    assert(isPlainObject({ foo: 1 }));
    assert(isPlainObject(Object.create(null)));
    // eslint-disable-next-line no-new-object
    assert(isPlainObject(new Object()));
    // not a plain object
    assert(!isPlainObject(new Date()));
    assert(!isPlainObject([1, 2, 3]));
  });
});

describe('decodeStream Tests', () => {
  it('decode gzip stream works', async () => {
    const encBuf = await gzip(TEST_DATA);
    const encStream = Readable.from(encBuf);
    const onError = sinon.fake();
    const decStream = decodeStream(200, { 'content-length': encBuf.length, 'content-encoding': 'gzip' }, encStream, onError);
    assert(onError.notCalled);
    const decBuf = await getStream.buffer(decStream);
    assert.strictEqual(Buffer.compare(decBuf, TEST_DATA), 0);
  });

  it('decode deflate stream works', async () => {
    const encBuf = await deflate(TEST_DATA);
    const encStream = Readable.from(encBuf);
    const onError = sinon.fake();
    const decStream = decodeStream(200, { 'content-length': encBuf.length, 'content-encoding': 'deflate' }, encStream, onError);
    assert(onError.notCalled);
    const decBuf = await getStream.buffer(decStream);
    assert.strictEqual(Buffer.compare(decBuf, TEST_DATA), 0);
  });

  it('decode brotli stream works', async () => {
    const encBuf = await brotliCompress(TEST_DATA);
    const encStream = Readable.from(encBuf);
    const onError = sinon.fake();
    const decStream = decodeStream(200, { 'content-length': encBuf.length, 'content-encoding': 'br' }, encStream, onError);
    assert(onError.notCalled);
    const decBuf = await getStream.buffer(decStream);
    assert.strictEqual(Buffer.compare(decBuf, TEST_DATA), 0);
  });

  it('decode gzip stream reports error if stream is corrupted', async () => {
    let encBuf = await gzip(TEST_DATA);
    // truncate, i.e. corrupt the encoded data
    encBuf = encBuf.slice(8);
    const encStream = Readable.from(encBuf);
    const onError = sinon.fake();
    const decStream = decodeStream(200, { 'content-length': encBuf.length, 'content-encoding': 'gzip' }, encStream, onError);
    await assert.rejects(async () => getStream.buffer(decStream));
    assert(onError.calledOnce);
  });

  it('don\'t decode status 204 response', async () => {
    const encBuf = await gzip(TEST_DATA);
    const encStream = Readable.from(encBuf);
    const onError = sinon.fake();
    const decStream = decodeStream(204, { 'content-length': encBuf.length, 'content-encoding': 'gzip' }, encStream, onError);
    assert(onError.notCalled);
    assert.strictEqual(encStream, decStream);
  });

  it('don\'t decode stream if content-encoding is invalid', async () => {
    const encBuf = await gzip(TEST_DATA);
    const encStream = Readable.from(encBuf);
    const onError = sinon.fake();
    const decStream = decodeStream(200, { 'content-length': encBuf.length, 'content-encoding': 'Gzip' }, encStream, onError);
    assert(onError.notCalled);
    assert.strictEqual(encStream, decStream);
  });
});
