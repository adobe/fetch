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

class FetchBaseError extends Error {
  constructor(message, type) {
    super(message);
    this.type = type;
  }

  get name() {
    return this.constructor.name;
  }

  get [Symbol.toStringTag]() {
    return this.constructor.name;
  }
}

/**
 * @typedef {{
 *   address?: string, code: string, dest?: string, errno: number, info?: object,
 *   message: string, path?: string, port?: number, syscall: string
 * }} SystemError
 */

class FetchError extends FetchBaseError {
  /**
   * @param {string} message error message
   * @param {string} [type] identifies the kind of error
   * @param {SystemError} [systemError] node system error
   */
  constructor(message, type, systemError) {
    super(message, type);
    if (systemError) {
      this.code = systemError.code;
      this.errno = systemError.errno;
      this.erroredSysCall = systemError.syscall;
    }
  }
}

class AbortError extends FetchBaseError {
  constructor(message, type = 'aborted') {
    super(message, type);
  }
}

export { FetchBaseError, FetchError, AbortError };
