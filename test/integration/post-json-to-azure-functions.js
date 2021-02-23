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
/* eslint-env mocha */
const assert = require('assert');
const { fetch } = require('../../src/index');

describe('Integration Tests (requires AZURE_AUTH to be set)', () => {
  it('Can POST a JSON body to Azure and get the respone accepted', async () => {
    const resp = await fetch('https://deploy-helix.scm.azurewebsites.net/api/settings', {
      method: 'POST',
      body: JSON.stringify({ FOO: 'bar' }),
      headers: {
        authorization: `Basic ${process.env.AZURE_AUTH}`,
        'Content-Type': 'application/json',
      },
    });
    assert.equal(resp.status, 204);
    assert.ok(resp.ok);
  });
});
