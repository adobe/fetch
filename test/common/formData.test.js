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
/* eslint-disable no-underscore-dangle */

import assert from 'assert';
import { fileURLToPath } from 'url';

import { FormData, File, Blob } from 'formdata-node';
// eslint-disable-next-line import/no-unresolved
import { fileFromPathSync } from 'formdata-node/file-from-path';

import { isReadableStream } from '../utils.js';
import { streamToBuffer } from '../../src/common/utils.js';
import { isFormData, FormDataSerializer } from '../../src/common/formData.js';

// Workaround for ES6 which doesn't support the NodeJS global __filename
const __filename = fileURLToPath(import.meta.url);

describe('FormData Helpers Test', () => {
  it('isFormData works', () => {
    assert(!isFormData());
    assert(!isFormData(null));
    assert(!isFormData({ foo: 'bar' }));
    assert(!isFormData('form=data'));
    assert(!isFormData(new URLSearchParams({ foo: 'bar' })));
    // spec-compliant FormData implementation
    const fd = new FormData();
    fd.set('foo', 'bar');
    assert(isFormData(fd));
  });

  it('FormDataSerializer works', async () => {
    // spec-compliant FormData implementation
    const fd = new FormData();
    fd.set('field1', 'foo');
    fd.set('field2', 'bar');
    fd.set('blob', new Blob([0x68, 0x65, 0x6c, 0x69, 0x78, 0x2d, 0x66, 0x65, 0x74, 0x63, 0x68]));
    fd.set('file', new File(['File content goes here'], 'file.txt'));
    fd.set('other_file', fileFromPathSync(__filename, 'source.js', { type: 'application/javascript' }));
    fd.set('file', fileFromPathSync(__filename));
    const fds = new FormDataSerializer(fd);
    const stream = fds.stream();
    assert(isReadableStream(stream));
    assert(typeof fds.length() === 'number');
    const buf = await streamToBuffer(fds.stream());
    assert.strictEqual(fds.length(), buf.length);
    assert(fds.contentType().startsWith('multipart/form-data; boundary='));
  });
});
