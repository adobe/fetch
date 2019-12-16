/*
 * Copyright 2019 Adobe. All rights reserved.
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

'use strict';

const assert = require('assert');
const { fetch } = require('../src/index.js');

describe('Fetch Tests', () => {
  it('fetch supports http/2', async () => {
    // https://http2.golang.org/serverpush
    const resp = await fetch('https://www.project-helix.info/index.html');
    assert.equal(resp.httpVersion, 2);
    assert.equal(resp.status, 200);
    // TODO: check cache for pushed resource(s)

    const pushedResp = await fetch('https://www.project-helix.info/helix_logo.png');
    assert.equal(pushedResp.httpVersion, 2);
    assert.equal(pushedResp.cached);
    assert.equal(pushedResp.status, 200);
  });
});
