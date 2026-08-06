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
import { Readable } from 'stream';

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

  it('FormDataSerializer escapes CRLF in field names, file names and blob type', async () => {
    // A CRLF-laden blob-like value. We drive the serializer with a hand-rolled
    // form iterable because both a spec Blob and formdata-node normalize/strip
    // these values before our serializer would ever see them; the duck-typed
    // isBlob() check, however, accepts an arbitrary blob-like object.
    const blob = {
      [Symbol.toStringTag]: 'Blob',
      name: 'evil\r\nX-Injected: filename.txt',
      type: 'text/plain\r\n\r\ninjected part',
      size: 4,
      arrayBuffer: async () => new ArrayBuffer(4),
      stream: () => Readable.from('data'),
      text: async () => 'data',
      slice: () => {},
    };
    const form = {
      * [Symbol.iterator]() {
        yield ['field\r\nX-Injected: name', 'value'];
        yield ['blob', blob];
      },
    };

    const fds = new FormDataSerializer(form);
    const buf = await streamToBuffer(fds.stream());
    const boundary = fds.contentType().slice('multipart/form-data; boundary='.length);
    const body = buf.toString();

    // The tainted values must not introduce raw CRLF into the body: a real
    // "\r\nX-Injected" / "\r\n\r\ninjected part" sequence would break out of the
    // intended part header / body framing.
    assert(!body.includes('\r\nX-Injected'));
    assert(!body.includes('\r\n\r\ninjected part'));
    // instead the CR/LF must be percent-escaped (names) or stripped (type)
    assert(body.includes('name="field%0D%0AX-Injected: name"'));
    assert(body.includes('filename="evil%0D%0AX-Injected: filename.txt"'));
    assert(body.includes('Content-Type: text/plaininjected part'));

    // sanity: the declared length still matches the produced body
    assert.strictEqual(fds.length(), buf.length);
    // and no rogue boundary was injected
    assert.strictEqual(body.split(`--${boundary}`).length - 1, 2 /* parts */ + 1 /* footer */);
  });
});
