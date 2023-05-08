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

export const enum ALPNProtocol {
  ALPN_HTTP2 = 'h2',
  ALPN_HTTP2C = 'h2c',
  ALPN_HTTP1_1 = 'http/1.1',
  ALPN_HTTP1_0 = 'http/1.0',
}

export interface Http1Options {
  /**
   * Keep sockets around in a pool to be used by other requests in the future.
   * @default false
   */
  keepAlive?: boolean;
  /**
   * When using HTTP KeepAlive, how often to send TCP KeepAlive packets over sockets being kept alive.
   * Only relevant if keepAlive is set to true.
   * @default 1000
   */
  keepAliveMsecs?: number;
  /**
   * Maximum number of sockets to allow per host.
   * @default Infinity
   */
  maxSockets?: number;
  /**
   * Maximum number of sockets allowed for all hosts in total. Each request will use a new socket until the maximum is reached.
   * @default Infinity
   */
  maxTotalSockets?: number;
  /**
   * Maximum number of sockets to leave open in a free state. Only relevant if keepAlive is set to true.
   * @default 256
   */
  maxFreeSockets?: number;
  /**
   * Socket timeout in milliseconds. This will set the timeout when the socket is connected.
   */
  timeout?: number;
  /**
   * Scheduling strategy to apply when picking the next free socket to use.
   * @default 'fifo'
   */
  scheduling?: 'fifo' | 'lifo';
  /**
   * (HTTPS only)
   * If not false, the server certificate is verified against the list of supplied CAs. An 'error' event is emitted if verification fails; err.code contains the OpenSSL error code.
   * @default true
   */
  rejectUnauthorized?: boolean;
  /**
   * (HTTPS only)
   * Maximum number of TLS cached sessions. Use 0 to disable TLS session caching.
   * @default 100
   */
  maxCachedSessions?: number;
}

type HeadersInit = Headers | Object | Iterable<readonly [string, string]> | Iterable<Iterable<string>>;

export interface RequestInit {
  /**
   * A BodyInit object or null to set request's body.
   */
  body?: BodyInit | Object |null;
  /**
   * A Headers object, an object literal, or an array of two-item arrays to set request's headers.
   */
  headers?: HeadersInit;
  /**
   * A string to set request's method.
   */
  method?: string;
}

export interface ResponseInit {
  headers?: HeadersInit;
  status?: number;
  statusText?: string;
}

type BodyInit =
  | Buffer
  | URLSearchParams
  | NodeJS.ReadableStream
  | string;

export class Headers implements Iterable<[string, string]> {
  constructor(init?: HeadersInit);

  append(name: string, value: string): void;
  delete(name: string): void;
  get(name: string): string | null;
  has(name: string): boolean;
  set(name: string, value: string): void;

  raw(): Record<string, string | string[]>;

  entries(): Iterator<[string, string]>;
  keys(): Iterator<string>;
  values(): Iterator<string>;
  [Symbol.iterator](): Iterator<[string, string]>;
}

export class Body {
  constructor(body?: BodyInit);

  readonly body: NodeJS.ReadableStream | null;
  readonly bodyUsed: boolean;

  buffer(): Promise<Buffer>;
  arrayBuffer(): Promise<ArrayBuffer>;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

type RequestInfo = string | Body;

export class Request extends Body {
  constructor(input: RequestInfo, init?: RequestInit);
  readonly headers: Headers;
  readonly method: string;
  readonly url: string;
}

export class Response extends Body {
  constructor(body?: BodyInit | Object | null, init?: ResponseInit);

  readonly url: string;
  readonly status: number;
  readonly statusText: string;
  readonly ok: boolean;
  readonly redirected: boolean;
  readonly httpVersion: string;
  readonly decoded: boolean;
  headers: Headers;
  clone(): Response;

  // non-spec extensions
  /**
   * A boolean specifying whether the response was retrieved from the cache.
   */
   readonly fromCache?: boolean;
}

export interface Http2Options {
  /**
   * Max idle time in milliseconds after which a session will be automatically closed.
   * @default 5 * 60 * 1000
   */
  idleSessionTimeout?: number;
  /**
   * Enable HTTP/2 Server Push?
   * @default true
   */
  enablePush?: boolean;
  /**
   * Max idle time in milliseconds after which a pushed stream will be automatically closed.
   * @default 5000
   */
  pushedStreamIdleTimeout?: number;
  /**
   * (HTTPS only)
   * If not false, the server certificate is verified against the list of supplied CAs. An 'error' event is emitted if verification fails; err.code contains the OpenSSL error code.
   * @default true
   */
  rejectUnauthorized?: boolean;
}

export interface ContextOptions {
  /**
   * Value of `user-agent` request header
   * @default 'adobe-fetch/<version>'
   */
  userAgent?: string;
  /**
   * The maximum total size of the cached entries (in bytes). 0 disables caching.
   * @default 100 * 1024 * 1024
   */
  maxCacheSize?: number;
  /**
   * The protocols to be negotiated, in order of preference
   * @default [ALPN_HTTP2, ALPN_HTTP1_1, ALPN_HTTP1_0]
   */
  alpnProtocols?: ReadonlyArray< ALPNProtocol >;
  /**
   * How long (in milliseconds) should ALPN information be cached for a given host?
   * @default 60 * 60 * 1000
   */
  alpnCacheTTL?: number;
  /**
   * Maximum number of ALPN cache entries
   * @default 100
   */
  alpnCacheSize?: number;
  /**
   * (HTTPS only, applies to HTTP/1.x and HTTP/2)
   * If not false, the server certificate is verified against the list of supplied CAs. An 'error' event is emitted if verification fails; err.code contains the OpenSSL error code.
   * @default true
   */
  rejectUnauthorized?: boolean;

  h1?: Http1Options;
  h2?: Http2Options;
}

export class AbortSignal {
	readonly aborted: boolean;

	addEventListener(type: 'abort', listener: (this: AbortSignal) => void): void;
	removeEventListener(type: 'abort', listener: (this: AbortSignal) => void): void;
}

export class TimeoutSignal extends AbortSignal {
  constructor(timeout: number);

  clear(): void;
}

export class AbortController {
  readonly signal: AbortSignal;
  abort(): void;
}

export interface RequestOptions {
  /**
   * A string specifying the HTTP request method.
   * @default 'GET'
   */
  method?: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS' | 'PATCH';
	/**
	 * A Headers object, an object literal, or an array of two-item arrays to set request's headers.
   * @default {}
	 */
  headers?: Headers | Object | Iterable<readonly [string, string]> | Iterable<Iterable<string>>;
	/**
	 * The request's body.
   * @default null
	 */
	body?: BodyInit | Object | FormData;
	/**
	 * A string indicating whether request follows redirects, results in an error upon encountering a redirect, or returns the redirect (in an opaque fashion). Sets request's redirect.
   * @default 'follow'
	 */
	redirect?: 'follow' | 'manual' | 'error';
	/**
	 * A string indicating how the request will interact with the browser's cache to set request's cache.
   * @default 'default'
	 */
	cache?: 'default' | 'no-store' | 'reload' | 'no-cache' | 'force-cache' | 'only-if-cached';
	/**
	 * An AbortSignal to set request's signal.
   * @default null
	 */
  signal?: AbortSignal;

  // non-spec extensions
  /**
   * A boolean specifying support of gzip/deflate/brotli content encoding.
   * @default true
   */
  compress?: boolean;
  /**
   * A boolean specifying whether gzip/deflate/brotli-endoced content should be decoded.
   * @default true
   */
   decode?: boolean;
   /**
   * Maximum number of redirects to follow, 0 to not follow redirect.
   * @default 20
   */
  follow?: number;
}

// Errors
export class FetchBaseError extends Error {
  type?: string;
}

export type SystemError = {
  address?: string;
  code: string;
  dest?: string;
  errno: number;
  info?: object;
  message: string;
  path?: string;
  port?: number;
  syscall: string;
};

export class FetchError extends FetchBaseError {
  code: string;
  errno?: number;
  erroredSysCall?: string;
}

export class AbortError extends FetchBaseError {
  type: 'aborted'
}

interface CacheStats {
  size: number;
  count: number;
}

export type PushHandler = (
  url: string,
  response: Response
) => void;

/**
 * Fetches a resource from the network. Returns a Promise which resolves once
 * the response is available.
 *
 * @param {string|Request} url
 * @param {RequestOptions} [options]
 * @returns {Promise<Response>}
 * @throws {FetchError}
 * @throws {AbortError}
 * @throws {TypeError}
 */
export function fetch(url: string|Request, options?: RequestOptions): Promise<Response>;

/**
 * Resets the current context, i.e. disconnects all open/pending sessions, clears caches etc..
 */
export function reset(): Promise<[void, void]>;

/**
 * Register a callback which gets called once a server Push has been received.
 *
 * @param {PushHandler} fn callback function invoked with the url and the pushed Response
 */
export function onPush(fn: PushHandler): void;

/**
 * Deregister a callback previously registered with {#onPush}.
 *
 * @param {PushHandler} fn callback function registered with {#onPush}
 */
export function offPush(fn: PushHandler): void;

/**
 * Create a URL with query parameters
 *
 * @param {string} url request url
 * @param {object} [qs={}] request query parameters
 */
export function createUrl(url: string, qs?: Record<string, unknown>): string;

/**
 * Creates a timeout signal which allows to specify
 * a timeout for a `fetch` operation via the `signal` option.
 *
 * @param {number} ms timeout in milliseconds
 */
export function timeoutSignal(ms: number): TimeoutSignal;

/**
 * Clear the cache entirely, throwing away all values.
 */
export function clearCache(): void;

/**
 * Cache stats for diagnostic purposes
 */
export function  cacheStats(): CacheStats;
