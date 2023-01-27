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

import http from 'http';

import { isPlainObject } from '../common/utils.js';

const { validateHeaderName, validateHeaderValue } = http;

const INTERNALS = Symbol('Headers internals');

const normalizeName = (name) => {
  const nm = typeof name !== 'string' ? String(name) : name;
  validateHeaderName(nm);
  return nm.toLowerCase();
};

const normalizeValue = (value, name) => {
  const val = typeof value !== 'string' ? String(value) : value;
  validateHeaderValue(name, val);
  return val;
};

/**
 * Headers class
 *
 * @see https://fetch.spec.whatwg.org/#headers-class
 */
class Headers {
  /**
   * Constructs a new Headers instance
   *
   * @constructor
   * @param {Object} [init={}]
   */
  constructor(init = {}) {
    this[INTERNALS] = {
      map: new Map(),
    };

    if (init instanceof Headers) {
      init[INTERNALS].map.forEach((value, name) => {
        this[INTERNALS].map.set(name, Array.isArray(value) ? [...value] : value);
      });
    } else if (Array.isArray(init)) {
      init.forEach(([name, value]) => {
        if (Array.isArray(value)) {
          // special case for Set-Cookie header which can have an array of values
          value.forEach((val) => {
            this.append(name, val);
          });
        } else {
          this.append(name, value);
        }
      });
    } else if (isPlainObject(init)) {
      for (const [name, value] of Object.entries(init)) {
        if (Array.isArray(value)) {
          // special case for Set-Cookie header which can have an array of values
          value.forEach((val) => {
            this.append(name, val);
          });
        } else {
          this.set(name, value);
        }
      }
    }
  }

  set(name, value) {
    this[INTERNALS].map.set(normalizeName(name), normalizeValue(value, name));
  }

  has(name) {
    return this[INTERNALS].map.has(normalizeName(name));
  }

  get(name) {
    const val = this[INTERNALS].map.get(normalizeName(name));
    if (val === undefined) {
      return null;
    } else if (Array.isArray(val)) {
      return val.join(', ');
    } else {
      return val;
    }
  }

  append(name, value) {
    const nm = normalizeName(name);
    const val = normalizeValue(value, name);
    const oldVal = this[INTERNALS].map.get(nm);
    if (Array.isArray(oldVal)) {
      oldVal.push(val);
    } else if (oldVal === undefined) {
      this[INTERNALS].map.set(nm, val);
    } else {
      this[INTERNALS].map.set(nm, [oldVal, val]);
    }
  }

  delete(name) {
    this[INTERNALS].map.delete(normalizeName(name));
  }

  forEach(callback, thisArg) {
    for (const name of this.keys()) {
      callback.call(thisArg, this.get(name), name);
    }
  }

  keys() {
    return Array.from(this[INTERNALS].map.keys())
      .sort();
  }

  * values() {
    for (const name of this.keys()) {
      yield this.get(name);
    }
  }

  /**
   * @type {() => IterableIterator<[string, string]>}
   */
  * entries() {
    for (const name of this.keys()) {
      yield [name, this.get(name)];
    }
  }

  /**
   * @type {() => IterableIterator<[string, string]>}
   */
  [Symbol.iterator]() {
    return this.entries();
  }

  get [Symbol.toStringTag]() {
    return this.constructor.name;
  }

  /**
   * Returns the headers as a plain object.
   * (non-spec extension)
   *
   * @returns {Record<string, string>}
   */
  plain() {
    return [...this.keys()].reduce((result, key) => {
      // eslint-disable-next-line no-param-reassign
      result[key] = this.get(key);
      return result;
    }, {});
  }

  /**
   * Returns the internal/raw representation of the
   * headers, i.e. the value of an multi-valued header
   * (added with <code>append()</code>) is an array of strings.
   * (non-spec extension)
   *
   * @returns {Record<string, string|string[]>}
   */
  raw() {
    return Object.fromEntries(this[INTERNALS].map);
  }
}

/**
 * Re-shaping object for Web IDL tests
 */
Object.defineProperties(
  Headers.prototype,
  [
    'append',
    'delete',
    'entries',
    'forEach',
    'get',
    'has',
    'keys',
    'set',
    'values',
  ].reduce((result, property) => {
    // eslint-disable-next-line no-param-reassign
    result[property] = { enumerable: true };
    return result;
  }, {}),
);

export default Headers;
