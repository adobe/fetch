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

import { EventEmitter } from 'events';

/**
 * Creates a lock (mutex) for asynchronous resources.
 *
 * Based on https://medium.com/trabe/synchronize-cache-updates-in-node-js-with-a-mutex-d5b395457138
 */
const lock = () => {
  const locked = {};
  const ee = new EventEmitter();
  ee.setMaxListeners(0);

  return {
    /**
     * Acquire a mutual exclusive lock.
     *
     * @param {string} key resource key to lock
     * @returns {Promise<*>} Promise which resolves with an option value passed on #release
     */
    acquire: (key) => new Promise((resolve) => {
      if (!locked[key]) {
        locked[key] = true;
        resolve();
        return;
      }

      const tryAcquire = (value) => {
        if (!locked[key]) {
          locked[key] = true;
          ee.removeListener(key, tryAcquire);
          resolve(value);
        }
      };

      ee.on(key, tryAcquire);
    }),

    /**
     * Release the mutual exclusive lock.
     *
     * @param {string} key resource key to release
     * @param {*} [value] optional value to be propagated
     *                    to all the code that's waiting for
     *                    the lock to release
     */
    release: (key, value) => {
      Reflect.deleteProperty(locked, key);
      setImmediate(() => ee.emit(key, value));
    },
  };
};

export default lock;
