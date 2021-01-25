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

const { FetchBaseError, FetchError, AbortError } = require('../../src/fetch/errors');

describe('fetch errors Tests', () => {
  it('FetchBaseError', () => {
    const err = new FetchBaseError('test');
    assert(err instanceof Error);
    assert.strictEqual(err.message, 'test');
    assert.strictEqual(err.name, 'FetchBaseError');
    assert.strictEqual(Object.prototype.toString.call(err), '[object FetchBaseError]');
  });

  it('FetchError', () => {
    const err = new FetchError('test');
    assert(err instanceof FetchBaseError);
    assert.strictEqual(err.message, 'test');
    assert.strictEqual(err.name, 'FetchError');
    assert.strictEqual(Object.prototype.toString.call(err), '[object FetchError]');
  });

  it('AbortError', () => {
    const err = new AbortError('test');
    assert(err instanceof FetchBaseError);
    assert.strictEqual(err.type, 'aborted');
    assert.strictEqual(err.message, 'test');
    assert.strictEqual(err.name, 'AbortError');
    assert.strictEqual(Object.prototype.toString.call(err), '[object AbortError]');
  });
});
