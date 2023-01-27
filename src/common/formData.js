/*
 * Copyright 2021 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { randomBytes } from 'crypto';
import { Readable } from 'stream';

// Misc. helper functions for dealing with spec-compliant FormData objects

const isBlob = (obj) => (typeof obj === 'object'
  && [
    'arrayBuffer',
    'stream',
    'text',
    'slice',
    'constructor',
  ]
    .map((nm) => typeof obj[nm])
    .filter((type) => type !== 'function')
    .length === 0
  && typeof obj.type === 'string'
  && typeof obj.size === 'number'
  && /^(Blob|File)$/.test(obj[Symbol.toStringTag]));

const isFormData = (obj) => (obj != null // neither null nor undefined
  && typeof obj === 'object'
  && [
    'append',
    'delete',
    'get',
    'getAll',
    'has',
    'set',
    'keys',
    'values',
    'entries',
    'constructor',
  ]
    .map((nm) => typeof obj[nm])
    .filter((type) => type !== 'function')
    .length === 0
  && obj[Symbol.toStringTag] === 'FormData');

const getFooter = (boundary) => `--${boundary}--\r\n\r\n`;

const getHeader = (boundary, name, field) => {
  let header = '';

  header += `--${boundary}\r\n`;
  header += `Content-Disposition: form-data; name="${name}"`;

  if (isBlob(field)) {
    header += `; filename="${field.name}"\r\n`;
    header += `Content-Type: ${field.type || 'application/octet-stream'}`;
  }

  return `${header}\r\n\r\n`;
};

/**
 * @param {FormData} form
 * @param {string} boundary
 *
 * @returns {string}
 */
async function* formDataIterator(form, boundary) {
  for (const [name, value] of form) {
    yield getHeader(boundary, name, value);

    if (isBlob(value)) {
      yield* value.stream();
    } else {
      yield value;
    }

    yield '\r\n';
  }

  yield getFooter(boundary);
}

/**
 * @param {FormData} form
 * @param {string} boundary
 *
 * @returns {number}
 */
const getFormDataLength = (form, boundary) => {
  let length = 0;

  for (const [name, value] of form) {
    length += Buffer.byteLength(getHeader(boundary, name, value));
    length += isBlob(value) ? value.size : Buffer.byteLength(String(value));
    length += Buffer.byteLength('\r\n');
  }
  length += Buffer.byteLength(getFooter(boundary));

  return length;
};

class FormDataSerializer {
  constructor(formData) {
    this.fd = formData;
    this.boundary = randomBytes(8).toString('hex');
  }

  length() {
    if (typeof this._length === 'undefined') {
      this._length = getFormDataLength(this.fd, this.boundary);
    }
    return this._length;
  }

  contentType() {
    return `multipart/form-data; boundary=${this.boundary}`;
  }

  stream() {
    return Readable.from(formDataIterator(this.fd, this.boundary));
  }
}

export {
  isFormData, FormDataSerializer,
};
