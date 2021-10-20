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

import assert from 'assert';
import { Readable } from 'stream';
import { promisify } from 'util';
import zlib from 'zlib';

import sinon from 'sinon';

import {
  decodeStream, isPlainObject, sizeof, streamToBuffer,
} from '../../src/common/utils.js';

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
    const decBuf = await streamToBuffer(decStream);
    assert.strictEqual(Buffer.compare(decBuf, TEST_DATA), 0);
  });

  it('decode deflate stream works', async () => {
    const encBuf = await deflate(TEST_DATA);
    const encStream = Readable.from(encBuf);
    const onError = sinon.fake();
    const decStream = decodeStream(200, { 'content-length': encBuf.length, 'content-encoding': 'deflate' }, encStream, onError);
    assert(onError.notCalled);
    const decBuf = await streamToBuffer(decStream);
    assert.strictEqual(Buffer.compare(decBuf, TEST_DATA), 0);
  });

  it('decode brotli stream works', async () => {
    const encBuf = await brotliCompress(TEST_DATA);
    const encStream = Readable.from(encBuf);
    const onError = sinon.fake();
    const decStream = decodeStream(200, { 'content-length': encBuf.length, 'content-encoding': 'br' }, encStream, onError);
    assert(onError.notCalled);
    const decBuf = await streamToBuffer(decStream);
    assert.strictEqual(Buffer.compare(decBuf, TEST_DATA), 0);
  });

  it('decode gzip stream reports error if stream is corrupted', async () => {
    let encBuf = await gzip(TEST_DATA);
    // truncate, i.e. corrupt the encoded data
    encBuf = encBuf.slice(8);
    const encStream = Readable.from(encBuf);
    const onError = sinon.fake();
    const decStream = decodeStream(200, { 'content-length': encBuf.length, 'content-encoding': 'gzip' }, encStream, onError);
    await assert.rejects(async () => streamToBuffer(decStream));
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

describe('sizeof Tests', () => {
  it('sizeof primitives works', async () => {
    assert.strictEqual(10, sizeof('12345'));
    assert.strictEqual(8, sizeof(42));
    assert.strictEqual(4, sizeof(true));
  });

  it('sizeof symbols works', async () => {
    const localSymbal = Symbol('foo');
    assert.strictEqual(6, sizeof(localSymbal));
    const globalSymbal = Symbol.for('bar');
    assert.strictEqual(6, sizeof(globalSymbal));
  });

  it('sizeof object with circular reference works', async () => {
    const obj = {
      a: 'a',
    };
    assert.strictEqual(sizeof(obj), 4);
    obj.b = obj;
    assert.strictEqual(sizeof(obj), 4 + 2);
  });

  it('sizeof array with circular reference works', async () => {
    const arr = ['a'];
    assert.strictEqual(sizeof(arr), 2);
    arr.push(arr);
    assert.strictEqual(sizeof(arr), 2);
  });
});

describe('streamToBuffer Tests', () => {
  it('streamToBuffer works', async () => {
    const stream = Readable.from(TEST_DATA);
    const buf = await streamToBuffer(stream);
    assert.strictEqual(Buffer.compare(buf, TEST_DATA), 0);
  });
});
