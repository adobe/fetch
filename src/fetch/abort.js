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

/* eslint-disable max-classes-per-file */

import { EventEmitter } from 'events';

const SIGNAL_INTERNALS = Symbol('AbortSignal internals');

/**
 * The AbortSignal class.
 *
 * @see https://dom.spec.whatwg.org/#interface-AbortSignal
 */
class AbortSignal {
  constructor() {
    this[SIGNAL_INTERNALS] = {
      eventEmitter: new EventEmitter(),
      onabort: null,
      aborted: false,
    };
  }

  get aborted() {
    return this[SIGNAL_INTERNALS].aborted;
  }

  get onabort() {
    return this[SIGNAL_INTERNALS].onabort;
  }

  set onabort(handler) {
    this[SIGNAL_INTERNALS].onabort = handler;
  }

  get [Symbol.toStringTag]() {
    return this.constructor.name;
  }

  removeEventListener(name, handler) {
    this[SIGNAL_INTERNALS].eventEmitter.removeListener(name, handler);
  }

  addEventListener(name, handler) {
    this[SIGNAL_INTERNALS].eventEmitter.on(name, handler);
  }

  dispatchEvent(type) {
    const event = { type, target: this };
    const handlerName = `on${type}`;

    if (typeof this[SIGNAL_INTERNALS][handlerName] === 'function') {
      this[handlerName](event);
    }

    this[SIGNAL_INTERNALS].eventEmitter.emit(type, event);
  }

  fire() {
    this[SIGNAL_INTERNALS].aborted = true;
    this.dispatchEvent('abort');
  }
}

Object.defineProperties(AbortSignal.prototype, {
  addEventListener: { enumerable: true },
  removeEventListener: { enumerable: true },
  dispatchEvent: { enumerable: true },
  aborted: { enumerable: true },
  onabort: { enumerable: true },
});

/**
 * The TimeoutSignal class.
 */
class TimeoutSignal extends AbortSignal {
  constructor(timeout) {
    if (!Number.isInteger(timeout)) {
      throw new TypeError(`Expected an integer, got ${typeof timeout}`);
    }
    super();
    this[SIGNAL_INTERNALS].timerId = setTimeout(() => {
      this.fire();
    }, timeout);
  }

  /**
   * Clear the timeout associated with this signal.
   */
  clear() {
    clearTimeout(this[SIGNAL_INTERNALS].timerId);
  }
}

Object.defineProperties(TimeoutSignal.prototype, {
  clear: { enumerable: true },
});

const CONTROLLER_INTERNALS = Symbol('AbortController internals');

/**
 * The AbortController class.
 *
 * @see https://dom.spec.whatwg.org/#interface-abortcontroller
 */
class AbortController {
  constructor() {
    this[CONTROLLER_INTERNALS] = {
      signal: new AbortSignal(),
    };
  }

  get signal() {
    return this[CONTROLLER_INTERNALS].signal;
  }

  get [Symbol.toStringTag]() {
    return this.constructor.name;
  }

  abort() {
    if (this[CONTROLLER_INTERNALS].signal.aborted) {
      return;
    }

    this[CONTROLLER_INTERNALS].signal.fire();
  }
}

Object.defineProperties(AbortController.prototype, {
  signal: { enumerable: true },
  abort: { enumerable: true },
});

export { AbortController, AbortSignal, TimeoutSignal };
