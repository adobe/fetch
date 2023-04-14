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

import Server from './server.js';

let server;

const HELLO_MSG = 'Hello, World!';

process.on('message', async (args) => {
  // received msg from parent process
  const {
    httpMajorVersion = 2,
    secure = true,
    helloMsg = HELLO_MSG,
    options = {},
  } = args;
  server = new Server(httpMajorVersion, secure, helloMsg, options);
  await server.start();
  // send msg to parent process
  process.send({ port: server.port, origin: server.origin, pid: process.pid });
});
