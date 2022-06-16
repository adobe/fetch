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

const { validateHeaderName, validateHeaderValue } = require('http');

const { isPlainObject } = require('../common/utils');

const INTERNALS = Symbol('Headers internals');

const normalizeName = (name) => {
  const nm = typeof name !== 'string' ? String(name) : name;

  /* istanbul ignore next */
  if (typeof validateHeaderName === 'function') {
    // since node 14.3.0
    validateHeaderName(nm);
  } else {
    // eslint-disable-next-line no-lonely-if
    if (!/^[\^`\-\w!#$%&'*+.|~]+$/.test(nm)) {
      const err = new TypeError(`Header name must be a valid HTTP token [${nm}]`);
      Object.defineProperty(err, 'code', { value: 'ERR_INVALID_HTTP_TOKEN' });
      throw err;
    }
  }

  return nm.toLowerCase();
};

const normalizeValue = (value, name) => {
  const val = typeof value !== 'string' ? String(value) : value;

  /* istanbul ignore next */
  if (typeof validateHeaderValue === 'function') {
    // since node 14.3.0
    validateHeaderValue(name, val);
  } else {
    // eslint-disable-next-line no-lonely-if
    if (/[^\t\u0020-\u007E\u0080-\u00FF]/.test(val)) {
      const err = new TypeError(`Invalid character in header content ["${name}"]`);
      Object.defineProperty(err, 'code', { value: 'ERR_INVALID_CHAR' });
      throw err;
    }
  }

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
      init.forEach((value, name) => {
        this.append(name, value);
      });
    } else if (Array.isArray(init)) {
      init.forEach(([name, value]) => {
        this.append(name, value);
      });
    } else /* istanbul ignore else  */ if (isPlainObject(init)) {
      for (const [name, value] of Object.entries(init)) {
        this.append(name, value);
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
    return val === undefined ? null : val;
  }

  append(name, value) {
    const nm = normalizeName(name);
    const val = normalizeValue(value, name);
    const oldVal = this[INTERNALS].map.get(nm);
    this[INTERNALS].map.set(nm, oldVal ? `${oldVal}, ${val}` : val);
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
   * (extension)
   *
   * @return {object}
   */
  plain() {
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

module.exports = {
  Headers,
};
