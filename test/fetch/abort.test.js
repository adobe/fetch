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

const sinon = require('sinon');

const { AbortController, AbortSignal } = require('../../src/fetch');

describe('AbortController Tests', () => {
  let controller;

  beforeEach(() => {
    controller = new AbortController();
  });

  it('should not be callable', () => {
    assert.throws(() => (AbortController)(), TypeError);
  });

  it('should have 2 properties', () => {
    const keys = new Set();
    keys.add('signal');
    keys.add('abort');

    for (const key in controller) {
      assert(keys.has(key), `'${key}' not found, but should have it`);
      keys.delete(key);
    }

    keys.forEach((key) => {
      assert(false, `'${key}' not found`);
    });
  });

  it('should be stringified as [object AbortController]', () => {
    assert(controller.toString() === '[object AbortController]');
  });

  describe('"signal" property', () => {
    let signal;

    beforeEach(() => {
      signal = controller.signal;
    });

    it('should return the same instance always', () => {
      assert(signal === controller.signal);
    });

    it('should be a AbortSignal object', () => {
      assert(signal instanceof AbortSignal);
    });

    it('should have 5 properties', () => {
      const keys = new Set();
      keys.add('addEventListener');
      keys.add('removeEventListener');
      keys.add('dispatchEvent');
      keys.add('aborted');
      keys.add('onabort');

      for (const key in signal) {
        assert(keys.has(key), `'${key}' found, but should not have it`);
        keys.delete(key);
      }

      keys.forEach((key) => {
        assert(false, `'${key}' not found`);
      });
    });

    it('should have "aborted" property which is false by default', () => {
      assert(signal.aborted === false);
    });

    it('should have "onabort" property which is null by default', () => {
      assert(signal.onabort === null);
    });

    it('should be stringified as [object AbortSignal]', () => {
      assert(signal.toString() === '[object AbortSignal]');
    });
  });

  describe('"abort" method', () => {
    it('should set true to "signal.aborted" property', () => {
      controller.abort();
      assert(controller.signal.aborted);
    });

    it('should fire "abort" event on "signal" (addEventListener)', () => {
      const listener = sinon.fake();
      controller.signal.addEventListener('abort', listener);
      controller.abort();

      assert(listener.calledOnce);
    });

    it('should fire "abort" event on "signal" (onabort)', () => {
      const listener = sinon.fake();
      controller.signal.onabort = listener;
      controller.abort();

      assert(listener.calledOnce);
    });

    it('should not fire "abort" event twice', () => {
      const listener = sinon.fake();
      controller.signal.addEventListener('abort', listener);
      controller.abort();
      controller.abort();
      controller.abort();

      assert(listener.calledOnce);
    });

    it('should not fire "abort" event after removing listener', () => {
      const listener = sinon.fake();
      controller.signal.addEventListener('abort', listener);
      controller.abort();

      assert(listener.calledOnce);

      controller.signal.removeEventListener('abort', listener);
      controller.abort();

      assert(listener.calledOnce);
    });

    it('should throw a TypeError if "this" is not an AbortController object', () => {
      assert.throws(() => controller.abort.call({}), TypeError);
    });
  });
});

describe('AbortSignal Tests', () => {
  it('should not be callable', () => {
    assert.throws(() => (AbortSignal)(), TypeError);
  });
});
