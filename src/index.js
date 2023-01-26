/*
 * Copyright 2022 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import api from './fetch/index.js';

export const ALPNProtocol = {
  ALPN_HTTP2: api.ALPN_HTTP2,
  ALPN_HTTP2C: api.ALPN_HTTP2C,
  ALPN_HTTP1_1: api.ALPN_HTTP1_1,
  ALPN_HTTP1_0: api.ALPN_HTTP1_0,
};

export const {
  fetch,
  context,
  reset,
  noCache,
  h1,
  keepAlive,
  h1NoCache,
  keepAliveNoCache,
  cacheStats,
  clearCache,
  offPush,
  onPush,
  createUrl,
  timeoutSignal,
  Body,
  Headers,
  Request,
  Response,
  AbortController,
  AbortError,
  AbortSignal,
  FetchBaseError,
  FetchError,
  ALPN_HTTP2,
  ALPN_HTTP2C,
  ALPN_HTTP1_1,
  ALPN_HTTP1_0,
} = api;
