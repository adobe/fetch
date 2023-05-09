<div align="center">
  <img src="banner.jpeg" alt="Adobe Fetch"/>
  <br>
  <p>Light-weight <a href="https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API">Fetch API</a> implementation transparently supporting both <b>HTTP/1(.1)</b> and <b>HTTP/2</b></p>
  <a href="https://codecov.io/gh/adobe/fetch"><img src="https://img.shields.io/codecov/c/github/adobe/fetch.svg" alt="codecov"></a>
  <a href="https://circleci.com/gh/adobe/fetch"><img src="https://img.shields.io/circleci/project/github/adobe/fetch.svg" alt="CircleCI"></a>
  <a href="https://github.com/adobe/fetch/blob/main/LICENSE.txt"><img src="https://img.shields.io/github/license/adobe/fetch.svg" alt="GitHub license"></a>
  <a href="https://github.com/adobe/fetch/issues"><img src="https://img.shields.io/github/issues/adobe/fetch.svg" alt="GitHub issues"></a>
  <a href="https://lgtm.com/projects/g/adobe/fetch"><img src="https://img.shields.io/lgtm/grade/javascript/g/adobe/fetch.svg?logo=lgtm&logoWidth=18" alt="LGTM Code Quality Grade: JavaScript"></a>
  <a href="https://renovatebot.com/"><img src="https://img.shields.io/badge/renovate-enabled-brightgreen.svg" alt="Renovate enabled"></a>
  <a href="https://github.com/semantic-release/semantic-release"><img src="https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg" alt="semantic-release"></a>
	<a href="https://packagephobia.now.sh/result?p=@adobe/fetch"><img src="https://badgen.net/packagephobia/install/@adobe/fetch" alt="Install size"></a>
  <a href="https://www.npmjs.com/package/@adobe/fetch"><img src="https://img.shields.io/npm/v/@adobe/fetch" alt="Current version"></a>
</div>

---

<!-- TOC -->
- [About](#about)
- [Features](#features)
- [ESM/CJS support](#esmcjs-support)
- [Installation](#installation)
- [API](#api)
  - [Context](#context)
- [Common Usage Examples](#common-usage-examples)
  - [Access Response Headers and other Meta data](#access-response-headers-and-other-meta-data)
  - [Fetch JSON](#fetch-json)
  - [Fetch text data](#fetch-text-data)
  - [Fetch binary data](#fetch-binary-data)
  - [Specify a timeout for a `fetch` operation](#specify-a-timeout-for-a-fetch-operation)
  - [Stream an image](#stream-an-image)
  - [Post JSON](#post-json)
  - [Post JPEG image](#post-jpeg-image)
  - [Post form data](#post-form-data)
  - [GET with query parameters object](#get-with-query-parameters-object)
  - [Cache](#cache)
- [Advanced Usage Examples](#advanced-usage-examples)
  - [HTTP/2 Server Push](#http2-server-push)
  - [Force HTTP/1(.1) protocol](#force-http11-protocol)
  - [HTTP/1.1 Keep-Alive](#http11-keep-alive)
  - [Extract Set-Cookie Header](#extract-set-cookie-header)
  - [Self-signed Certificates](#self-signed-certificates)
  - [Set cache size limit](#set-cache-size-limit)
  - [Disable caching](#disable-caching)
  - [Set a custom user agent](#set-a-custom-user-agent)
- [More examples](#more-examples)
- [Development](#development)
  - [Build](#build)
  - [Test](#test)
  - [Lint](#lint)
  - [Troubleshooting](#troubleshooting)
- [Acknowledgement](#acknowledgement)
- [License](#license)
<!-- /TOC -->

---

## About

`@adobe/fetch` in general adheres to the [Fetch API Specification](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API), implementing a subset of the API. However, there are some notable deviations:

* `Response.body` returns a Node.js [Readable stream](https://nodejs.org/api/stream.html#stream_readable_streams).
* `Response.blob()` is not implemented. Use `Response.buffer()` instead.
* `Response.formData()` is not implemented.
* Cookies are not stored by default. However, cookies can be extracted and passed by manipulating request and response headers.
* The following values of the `fetch()` option `cache` are supported: `'default'` (the implicit default) and `'no-store'`. All other values are currently ignored.  
* The following `fetch()` options are ignored due to the nature of Node.js and since `@adobe/fetch` doesn't have the concept of web pages: `mode`, `referrer`, `referrerPolicy`, `integrity` and `credentials`.
* The `fetch()` option `keepalive` is not supported. But you can use the `h1.keepAlive` context option, as demonstrated [here](#http11-keep-alive).

`@adobe/fetch` also supports the following non-spec extensions:

* `Response.buffer()` returns a Node.js `Buffer`.
* `Response.url` contains the final url when following redirects.
* The `body` that can be sent in a `Request` can also be a `Readable` Node.js stream, a `Buffer`, a string or a plain object.
* There are no forbidden header names.
* The `Response` object has an extra property `httpVersion` which is one of `'1.0'`, `'1.1'` or `'2.0'`, depending on what was negotiated with the server.
* The `Response` object has an extra property `fromCache` which determines whether the response was retrieved from cache.
* The `Response` object has an extra property `decoded` which determines whether the response body was automatically decoded (see Fetch option `decode` below).
* `Response.headers.plain()` returns the headers as a plain object.
* `Response.headers.raw()` returns the internal/raw representation of the headers where e.g. the `Set-Cokkie` header is represented with an array of strings value.
* The Fetch option `follow` allows to limit the number of redirects to follow (default: `20`).
* The Fetch option `compress` enables transparent gzip/deflate/br content encoding (default: `true`).
* The Fetch option `decode` enables transparent gzip/deflate/br content decoding (default: `true`).

Note that non-standard Fetch options have been aligned with [node-fetch](https://github.com/node-fetch/node-fetch) where appropriate.
  
## Features

* [x] supports reasonable subset of the standard [Fetch specification](https://fetch.spec.whatwg.org/)
* [x] Transparent handling of HTTP/1(.1) and HTTP/2 connections
* [x] [RFC 7234](https://httpwg.org/specs/rfc7234.html) compliant cache
* [x] Support `gzip/deflate/br` content encoding
* [x] HTTP/2 request and response multiplexing support
* [x] HTTP/2 Server Push support (transparent caching and explicit listener support)
* [x] overridable User-Agent
* [x] low-level HTTP/1.* agent/connect options support (e.g. `keepAlive`, `rejectUnauthorized`)


## ESM/CJS support

This package is native [ESM](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) and no longer provides CommonJS exports. Use `3.x` version if you still need to use this package with CommonJS.

## Installation

> **Note**:
>
> As of v4 Node version >= 14.16 is required.

```bash
$ npm install @adobe/fetch
```

## API

Apart from the standard Fetch API

* `fetch()`
* `Request`
* `Response`
* `Headers`
* `Body`

`@adobe/fetch` exposes the following non-spec extensions:

* `context()` - creates a new customized API context
* `reset()` - resets the current API context, i.e. closes pending sessions/sockets, clears internal caches, etc ...
* `onPush()` - registers an HTTP/2 Server Push listener
* `offPush()`- deregisters a listener previously registered with `onPush()`
* `clearCache()` - clears the HTTP cache (cached responses)
* `cacheStats()` - returns cache statistics
* `noCache()` - creates a customized API context with disabled caching (_convenience_)
* `h1()` - creates a customized API context with enforced HTTP/1.1 protocol (_convenience_)
* `keepAlive()` - creates a customized API context with enforced HTTP/1.1 protocol and persistent connections (_convenience_)
* `h1NoCache()` - creates a customized API context with disabled caching and enforced HTTP/1.1 protocol (_convenience_)
* `keepAliveNoCache()` - creates a customized API context with disabled caching and enforced HTTP/1.1 protocol with persistent connections (_convenience_)
* `createUrl()` - creates a URL with query parameters (_convenience_)
* `timeoutSignal()` - ceates a timeout signal (_convenience_)

### Context

An API context allows to customize certain aspects of the implementation and provides isolation of internal structures (session caches, HTTP cache, etc.) per API context.

The following options are supported:

```ts
interface ContextOptions {
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
   * (HTTPS only, applies to HTTP/1.x and HTTP/2)
   * If not false, the server certificate is verified against the list of supplied CAs. An 'error' event is emitted if verification fails; err.code contains the OpenSSL error code.
   * @default true
   */
  rejectUnauthorized?: boolean;
  /**
   * Maximum number of ALPN cache entries
   * @default 100
   */
  alpnCacheSize?: number;
  h1?: Http1Options;
  h2?: Http2Options;
};

interface Http1Options {
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

interface Http2Options {
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
};
```

## Common Usage Examples

### Access Response Headers and other Meta data

```javascript
  import { fetch } from '@adobe/fetch';

  const resp = await fetch('https://httpbin.org/get');
  console.log(resp.ok);
  console.log(resp.status);
  console.log(resp.statusText);
  console.log(resp.httpVersion);
  console.log(resp.headers.plain());
  console.log(resp.headers.get('content-type'));
```

### Fetch JSON

```javascript
  import { fetch } from '@adobe/fetch';

  const resp = await fetch('https://httpbin.org/json');
  const jsonData = await resp.json();
```

### Fetch text data

```javascript
  import { fetch } from '@adobe/fetch';

  const resp = await fetch('https://httpbin.org/');
  const textData = await resp.text();
```

### Fetch binary data

```javascript
  import { fetch } from '@adobe/fetch';

  const resp = await fetch('https://httpbin.org//stream-bytes/65535');
  const imageData = await resp.buffer();
```

### Specify a timeout for a `fetch` operation

Using `timeoutSignal(ms)` non-spec extension:

```javascript
  import { fetch, timeoutSignal, AbortError } from '@adobe/fetch';

  const signal = timeoutSignal(1000);
  try {
    const resp = await fetch('https://httpbin.org/json', { signal });
    const jsonData = await resp.json();
  } catch (err) {
    if (err instanceof AbortError) {
      console.log('fetch timed out after 1s');
    }
  } finally {
    // avoid pending timers which prevent node process from exiting
    signal.clear();
  }
```

Using `AbortController`:

```javascript
  import { fetch, AbortController, AbortError } from '@adobe/fetch';

  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), 1000);
  const { signal } = controller;

  try {
    const resp = await fetch('https://httpbin.org/json', { signal });
    const jsonData = await resp.json();
  } catch (err) {
    if (err instanceof AbortError) {
      console.log('fetch timed out after 1s');
    }
  } finally {
    // avoid pending timers which prevent node process from exiting
    clearTimeout(timerId);
  }
```

### Stream an image

```javascript
  import { createWriteStream } from 'fs';
  import { fetch } from '@adobe/fetch';

  const resp = await fetch('https://httpbin.org/image/jpeg');
  resp.body.pipe(createWriteStream('saved-image.jpg'));
```

### Post JSON

```javascript
  import { fetch } from '@adobe/fetch';

  const method = 'POST';
  const body = { foo: 'bar' };
  const resp = await fetch('https://httpbin.org/post', { method, body });
```

### Post JPEG image

```javascript
  import { createReadStream } from 'fs';
  import { fetch } from '@adobe/fetch';

  const method = 'POST';
  const body = createReadStream('some-image.jpg');
  const headers = { 'content-type': 'image/jpeg' };
  const resp = await fetch('https://httpbin.org/post', { method, body, headers });
```

### Post form data

```javascript
  import { FormData, Blob, File } from 'formdata-node'; // spec-compliant implementations
  import { fileFromPath } from 'formdata-node/file-from-path'; // helper for creating File instance from disk file

  import { fetch } from '@adobe/fetch';

  const method = 'POST';
  const fd = new FormData();
  fd.set('field1', 'foo');
  fd.set('field2', 'bar');
  fd.set('blob', new Blob([0x68, 0x65, 0x6c, 0x69, 0x78, 0x2d, 0x66, 0x65, 0x74, 0x63, 0x68]));
  fd.set('file', new File(['File content goes here'], 'file.txt'));
  fd.set('other_file', await fileFromPath('/foo/bar.jpg', 'bar.jpg', { type: 'image/jpeg' }));
  const resp = await fetch('https://httpbin.org/post', { method, body: fd });
```

### GET with query parameters object

```javascript
import { createUrl, fetch } from '@adobe/fetch';

const qs = {
  fake: 'dummy',
  foo: 'bar',
  rumple: "stiltskin",
};

const resp = await fetch(createUrl('https://httpbin.org/json', qs));
```

or using `URLSearchParams`:

```javascript
import { fetch } from '@adobe/fetch';

const body = new URLSearchParams({
  fake: 'dummy',
  foo: 'bar',
  rumple: "stiltskin",
});

const resp = await fetch('https://httpbin.org/json', { body });
```

### Cache

Responses of `GET` and `HEAD` requests are by default cached, according to the rules of [RFC 7234](https://httpwg.org/specs/rfc7234.html):

```javascript
import { fetch } from '@adobe/fetch';

const url = 'https://httpbin.org/cache/60'; // -> max-age=60 (seconds)
// send initial request, priming cache
let resp = await fetch(url);
assert(resp.ok);
assert(!resp.fromCache);

// re-send request and verify it's served from cache
resp = await fetch(url);
assert(resp.ok);
assert(resp.fromCache);
```

You can disable caching per request with the `cache: 'no-store'` option:

```javascript
import { fetch } from '@adobe/fetch';

const resp = await fetch('https://httbin.org/', { cache: 'no-store' });
assert(resp.ok);
assert(!resp.fromCache);
```

You can disable caching entirely:

```javascript
import { noCache } from '@adobe/fetch';
const { fetch } = noCache();
```

## Advanced Usage Examples

### HTTP/2 Server Push

Note that pushed resources will be automatically and transparently added to the cache.
You can however add a listener which will be notified on every pushed (and cached) resource.

```javascript
  import { fetch, onPush } from '@adobe/fetch';

  onPush((url, response) => console.log(`received server push: ${url} status ${response.status}`));

  const resp = await fetch('https://nghttp2.org');
  console.log(`Http version: ${resp.httpVersion}`);
```

### Use h2c (http2 cleartext w/prior-knowledge) protocol

```javascript
  import { fetch } from '@adobe/fetch';

  const resp = await fetch('http2://nghttp2.org');
  console.log(`Http version: ${resp.httpVersion}`);
```

### Force HTTP/1(.1) protocol

```javascript
  import { h1 } from '@adobe/fetch';
  const { fetch } = h1();

  const resp = await fetch('https://nghttp2.org');
  console.log(`Http version: ${resp.httpVersion}`);
```

### HTTP/1.1 Keep-Alive

```javascript
import { keepAlive } from '@adobe/fetch';
const { fetch } = keepAlive();

const resp = await fetch('https://httpbin.org/status/200');
console.log(`Connection: ${resp.headers.get('connection')}`); // -> keep-alive
```

### Extract Set-Cookie Header

Unlike browsers, you can access raw `Set-Cookie` headers manually using `Headers.raw()`. This is an `@adobe/fetch` only API.

```javascript
import { fetch } from '@adobe/fetch';

const resp = await fetch('https://httpbin.org/cookies/set?a=1&b=2');
// returns an array of values, instead of a string of comma-separated values
console.log(resp.headers.raw()['set-cookie']);
```

### Self-signed Certificates

```javascript
import { context } from '@adobe/fetch';
const { fetch } = context({ rejectUnauthorized: false });

const resp = await fetch('https://localhost:8443/');  // a server using a self-signed certificate
```

### Set cache size limit

```javascript
  import { context } from '@adobe/fetch';
  const { fetch } = context({
    maxCacheSize: 100 * 1024, // 100kb (Default: 100mb)
  });

  let resp = await fetch('https://httpbin.org/bytes/60000'); // ~60kb response
  resp = await fetch('https://httpbin.org/bytes/50000'); // ~50kb response
  console.log(cacheStats());
```

### Disable caching

```javascript
  import { noCache } from '@adobe/fetch';
  const { fetch } = noCache();

  let resp = await fetch('https://httpbin.org/cache/60'); // -> max-age=60 (seconds)
  // re-fetch
  resp = await fetch('https://httpbin.org/cache/60');
  assert(!resp.fromCache);
```

### Set a custom user agent

```javascript
  import { context } from '@adobe/fetch';
  const { fetch } = context({
    userAgent: 'custom-fetch'
  });

  const resp = await fetch('https://httpbin.org//user-agent');
  const json = await resp.json();
  console.log(json['user-agent']);
```

## More examples

More example code can be found in the [test source files](/test/).

## Development

### Build

```bash
$ npm install
```

### Test

```bash
$ npm test
```

### Lint

```bash
$ npm run lint
```

### Troubleshooting

You can enable `@adobe/fetch` low-level debug console output by setting the `DEBUG` environment variable to `adobe/fetch*`, e.g.:

```bash
$ DEBUG=adobe/fetch* node test.js
```

This will produce console outout similar to:

```bash
  ...
  adobe/fetch:core established TLS connection: #48 (www.nghttp2.org) +2s
  adobe/fetch:core www.nghttp2.org -> h2 +0ms
  adobe/fetch:h2 reusing socket #48 (www.nghttp2.org) +2s
  adobe/fetch:h2 GET www.nghttp2.org/httpbin/user-agent +0ms
  adobe/fetch:h2 session https://www.nghttp2.org established +1ms
  adobe/fetch:h2 caching session https://www.nghttp2.org +0ms
  adobe/fetch:h2 session https://www.nghttp2.org remoteSettings: {"headerTableSize":8192,"enablePush":true,"initialWindowSize":1048576,"maxFrameSize":16384,"maxConcurrentStreams":100,"maxHeaderListSize":4294967295,"maxHeaderSize":4294967295,"enableConnectProtocol":true} +263ms
  adobe/fetch:h2 session https://www.nghttp2.org localSettings: {"headerTableSize":4096,"enablePush":true,"initialWindowSize":65535,"maxFrameSize":16384,"maxConcurrentStreams":4294967295,"maxHeaderListSize":4294967295,"maxHeaderSize":4294967295,"enableConnectProtocol":false} +0ms
  adobe/fetch:h2 session https://www.nghttp2.org closed +6ms
  adobe/fetch:h2 discarding cached session https://www.nghttp2.org +0ms
  ... 
```

Additionally, you can enable Node.js low-level debug console output by setting the `NODE_DEBUG` environment variable appropriately, e.g.

```bash
$ export NODE_DEBUG=http*,stream*
$ export DEBUG=adobe/fetch*

$ node test.js
```

> Note: this will flood the console with highly verbose debug output.

## Acknowledgement

Thanks to [node-fetch](https://github.com/node-fetch/node-fetch) and [github/fetch](https://github.com/github/fetch) for providing a solid implementation reference.

## License

[Apache 2.0](LICENSE.txt)
