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
/* eslint-disable guard-for-in */
/* eslint-disable no-restricted-syntax */

'use strict';

const assert = require('assert');

const { createUrl, timeoutSignal } = require('../../src');

describe('Misc. Tests', () => {
  it('createUrl encodes query paramters', async () => {
    const EXPECTED = 'https://httpbin.org/json?helix=42&dummy=true&name=Andr%C3%A9+Citro%C3%ABn&rumple=stiltskin&nephews=Huey&nephews=Louie&nephews=Dewey';
    const qs = {
      helix: 42,
      dummy: true,
      name: 'André Citroën',
      rumple: 'stiltskin',
      nephews: ['Huey', 'Louie', 'Dewey'],
    };
    const ACTUAL = createUrl('https://httpbin.org/json', qs);
    assert.strictEqual(ACTUAL, EXPECTED);
  });

  it('createUrl works without qs object', async () => {
    const EXPECTED = 'https://httpbin.org/json';
    const ACTUAL = createUrl('https://httpbin.org/json');
    assert.strictEqual(ACTUAL, EXPECTED);
  });

  it('createUrl checks arguments types', async () => {
    assert.throws(() => createUrl(true));
    assert.throws(() => createUrl('https://httpbin.org/json', 'abc'));
    assert.throws(() => createUrl('https://httpbin.org/json', 123));
    assert.throws(() => createUrl('https://httpbin.org/json', ['foo', 'bar']));
  });

  it('timeoutSignal works', async () => {
    const fired = async (signal) => new Promise((resolve) => {
      signal.addEventListener('abort', resolve);
    });

    const ts0 = Date.now();
    await fired(timeoutSignal(500));
    const ts1 = Date.now();
    assert((ts1 - ts0) < 500 * 1.05);
  });
});
