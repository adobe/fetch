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

export * from './api';
import * as api from './api.d';
import { ContextOptions } from './api';

declare type FetchAPI = typeof api;

/**
  * This function returns an object which looks like the public API,
  * i.e. it will have the functions `fetch`, `context`, `reset`, etc. and provide its
  * own isolated caches and specific behavior according to `options`.
  *
  * @param {ContextOptions} options
  */
export declare function context(options?: ContextOptions): FetchAPI;

/**
 * Convenience function which creates a new context with disabled caching,
 * the equivalent of `context({ maxCacheSize: 0 })`.
 *
 * The optional `options` parameter allows to specify further options.
 *
  * @param {ContextOptions} options
 */
export declare function noCache(options?: ContextOptions): FetchAPI;
 
 /**
  * Convenience function which creates a new context with enforced HTTP/1.1 protocol,
  * the equivalent of `context({ alpnProtocols: [ALPN_HTTP1_1] })`.
  *
  * The optional `options` parameter allows to specify further options.
  *
  * @param {ContextOptions} options
  */
 export declare function h1(options?: ContextOptions): FetchAPI;
  
 /**
  * Convenience function which creates a new context with enforced HTTP/1.1 protocol
  * with persistent connections (keep-alive), the equivalent of
  * `context({ alpnProtocols: [ALPN_HTTP1_1], h1: { keepAlive: true } })`.
  *
  * The optional `options` parameter allows to specify further options.
  *
  * @param {ContextOptions} options
  */
 export declare function keepAlive(options?: ContextOptions): FetchAPI;
 
 /**
  * Convenience function which creates a new context with disabled caching
  * and enforced HTTP/1.1 protocol, a combination of `h1()` and `noCache()`.
  *
  * The optional `options` parameter allows to specify further options.
  *
  * @param {ContextOptions} options
  */
 export declare function h1NoCache(options?: ContextOptions): FetchAPI;
 
 /**
  * Convenience function which creates a new context with disabled caching
  * and enforced HTTP/1.1 protocol with persistent connections (keep-alive),
  * a combination of `keepAlive()` and `noCache()`.
  *
  * The optional `options` parameter allows to specify further options.
  *
  * @param {ContextOptions} options
  */
 export declare function keepAliveNoCache(options?: ContextOptions): FetchAPI;
 