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

/* eslint-disable no-underscore-dangle */
import { parse, getBoundary } from 'parse-multipart-data';

// misc. test helpers

const isReadableStream = (val) => val !== null
  && typeof val === 'object'
  && typeof val.pipe === 'function'
  && val.readable !== false
  && typeof val._read === 'function'
  && typeof val._readableState === 'object';

const parseMultiPartFormData = (contentType, body) => {
  const boundary = getBoundary(contentType);
  const parts = parse(body, boundary);
  const form = {};
  for (const { name, data } of parts) {
    form[name] = data.toString();
  }
  return form;
};

export { isReadableStream, parseMultiPartFormData };
