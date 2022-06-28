<div align="center">
  <img src="banner.jpeg" alt="Helix Fetch"/>
  <br>
  <p>Light-weight <a href="https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API">Fetch API</a> implementation transparently supporting both <b>HTTP/1(.1)</b> and <b>HTTP/2</b></p>
  <a href="https://codecov.io/gh/adobe/helix-fetch"><img src="https://img.shields.io/codecov/c/github/adobe/helix-fetch.svg" alt="codecov"></a>
  <a href="https://circleci.com/gh/adobe/helix-fetch"><img src="https://img.shields.io/circleci/project/github/adobe/helix-fetch.svg" alt="CircleCI"></a>
  <a href="https://github.com/adobe/helix-fetch/blob/main/LICENSE.txt"><img src="https://img.shields.io/github/license/adobe/helix-fetch.svg" alt="GitHub license"></a>
  <a href="https://github.com/adobe/helix-fetch/issues"><img src="https://img.shields.io/github/issues/adobe/helix-fetch.svg" alt="GitHub issues"></a>
  <a href="https://lgtm.com/projects/g/adobe/helix-fetch"><img src="https://img.shields.io/lgtm/grade/javascript/g/adobe/helix-fetch.svg?logo=lgtm&logoWidth=18" alt="LGTM Code Quality Grade: JavaScript"></a>
  <a href="https://renovatebot.com/"><img src="https://img.shields.io/badge/renovate-enabled-brightgreen.svg" alt="Renovate enabled"></a>
  <a href="https://github.com/semantic-release/semantic-release"><img src="https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg" alt="semantic-release"></a>
	<a href="https://packagephobia.now.sh/result?p=@adobe/helix-fetch"><img src="https://badgen.net/packagephobia/install/@adobe/helix-fetch" alt="Install size"></a>
  <a href="https://www.npmjs.com/package/@adobe/helix-fetch"><img src="https://img.shields.io/npm/v/@adobe/helix-fetch" alt="Current version"></a>
</div>

---

<!-- TOC -->
- [About](#about)
- [Features](#features)
- [Installation](#installation)
- [Upgrading](#upgrading)
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

`helix-fetch` in general adheres to the [Fetch API Specification](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API), implementing a subset of the API. However, there are some notable deviations:

* `Response.body` returns a Node.js [Readable stream](https://nodejs.org/api/stream.html#stream_readable_streams).
* `Response.blob()` is not implemented. Use `Response.buffer()` instead.
* `Response.formData()` is not implemented.
* Cookies are not stored by default. However, cookies can be extracted and passed by manipulating request and response headers.
* The following values of the `fetch()` option `cache` are supported: `'default'` (the implicit default) and `'no-store'`. All other values are currently ignored.  
* The following `fetch()` options are ignored due to the nature of Node.js and since `helix-fetch` doesn't have the concept of web pages: `mode`, `referrer`, `referrerPolicy`, `integrity` and `credentials`.
* The `fetch()` option `keepalive` is not supported. But you can use the `h1.keepAlive` context option, as demonstrated [here](#http11-keep-alive).

`helix-fetch` also supports the following extensions:

* `Response.buffer()` returns a Node.js `Buffer`.
* `Response.url` contains the final url when following redirects.
* The `body` that can be sent in a `Request` can also be a `Readable` Node.js stream, a `Buffer`, a string or a plain object.
* There are no forbidden header names.
* The `Response` object has an extra property `httpVersion` which is one of `'1.0'`, `'1.1'` or `'2.0'`, depending on what was negotiated with the server.
* The `Response` object has an extra property `fromCache` which determines whether the response was retrieved from cache.
* The `Response` object has an extra property `decoded` which determines whether the response body was automatically decoded (see Fetch option `decode` below).
* `Response.headers.plain()` returns the headers as a plain object.
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

## Installation

> **Note**:
>
> As of v2 Node version >= 12 is required.

```bash
$ npm install @adobe/helix-fetch
```

## Upgrading

Upgrading from an old version of `helix-fetch`? Check out the following files:

- [1.x to 2.x Upgrade Guide](v2-UPGRADE-GUIDE.md)
- [Changelog](CHANGELOG.md)

## API

Apart from the standard Fetch API

* `fetch()`
* `Request`
* `Response`
* `Headers`
* `Body`

`helix-fetch` exposes the following extensions:

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
   * @default 'helix-fetch/<version>'
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
  const { fetch } = require('@adobe/helix-fetch');

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
  const { fetch } = require('@adobe/helix-fetch');

  const resp = await fetch('https://httpbin.org/json');
  const jsonData = await resp.json();
```

### Fetch text data

```javascript
  const { fetch } = require('@adobe/helix-fetch');

  const resp = await fetch('https://httpbin.org/');
  const textData = await resp.text();
```

### Fetch binary data

```javascript
  const { fetch } = require('@adobe/helix-fetch');

  const resp = await fetch('https://httpbin.org//stream-bytes/65535');
  const imageData = await resp.buffer();
```

### Specify a timeout for a `fetch` operation

Using `timeoutSignal(ms)` extension:

```javascript
  const { fetch, timeoutSignal, AbortError } = require('@adobe/helix-fetch');

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
  const { fetch, AbortController, AbortError } = require('@adobe/helix-fetch');

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
  const fs = require('fs');
  const { fetch } = require('@adobe/helix-fetch');

  const resp = await fetch('https://httpbin.org/image/jpeg');
  resp.body.pipe(fs.createWriteStream('saved-image.jpg'));
```

### Post JSON

```javascript
  const { fetch } = require('@adobe/helix-fetch');

  const method = 'POST';
  const body = { foo: 'bar' };
  const resp = await fetch('https://httpbin.org/post', { method, body });
```

### Post JPEG image

```javascript
  const fs = require('fs');
  const { fetch } = require('@adobe/helix-fetch');

  const method = 'POST';
  const body = fs.createReadStream('some-image.jpg');
  const headers = { 'content-type': 'image/jpeg' };
  const resp = await fetch('https://httpbin.org/post', { method, body, headers });
```

### Post form data

```javascript
  const { FormData, Blob, File } = require('formdata-node'); // spec-compliant implementations
  const { fileFromPath } = require('formdata-node/file-from-path'); // helper for creating File instance from disk file

  const { fetch } = require('@adobe/helix-fetch');

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
const { createUrl, fetch } = require('@adobe/helix-fetch');

const qs = {
  helix: 'dummy',
  foo: 'bar',
  rumple: "stiltskin",
};

const resp = await fetch(createUrl('https://httpbin.org/json', qs));
```

or using `URLSearchParams`:

```javascript
const { fetch } = require('@adobe/helix-fetch');

const body = new URLSearchParams({
  helix: 'dummy',
  foo: 'bar',
  rumple: "stiltskin",
});

const resp = await fetch('https://httpbin.org/json', { body });
```

### Cache

Responses of `GET` and `HEAD` requests are by default cached, according to the rules of [RFC 7234](https://httpwg.org/specs/rfc7234.html):

```javascript
const { fetch } = require('@adobe/helix-fetch');

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
const { fetch } = require('@adobe/helix-fetch');

const resp = await fetch('https://httbin.org/', { cache: 'no-store' });
assert(resp.ok);
assert(!resp.fromCache);
```

You can disable caching entirely:

```javascript
const { fetch } = require('@adobe/helix-fetch').noCache();
```

## Advanced Usage Examples

### HTTP/2 Server Push

Note that pushed resources will be automatically and transparently added to the cache.
You can however add a listener which will be notified on every pushed (and cached) resource.

```javascript
  const { fetch, onPush } = require('@adobe/helix-fetch');

  onPush((url, response) => console.log(`received server push: ${url} status ${response.status}`));

  const resp = await fetch('https://nghttp2.org');
  console.log(`Http version: ${resp.httpVersion}`);
```

### Force HTTP/1(.1) protocol

```javascript
  const { fetch } = require('@adobe/helix-fetch').h1();

  const resp = await fetch('https://nghttp2.org');
  console.log(`Http version: ${resp.httpVersion}`);
```

### HTTP/1.1 Keep-Alive

```javascript
const { fetch } = require('@adobe/helix-fetch').keepAlive();

const resp = await fetch('https://httpbin.org/status/200');
console.log(`Connection: ${resp.headers.get('connection')}`); // -> keep-alive
```

### Self-signed Certificates

```javascript
const { fetch } = require('@adobe/helix-fetch').context({ rejectUnauthorized: false });

const resp = await fetch('https://localhost:8443/');  // a server using a self-signed certificate
```

### Set cache size limit

```javascript
  const { fetch, cacheStats } = require('@adobe/helix-fetch').context({
    maxCacheSize: 100 * 1024, // 100kb (Default: 100mb)
  });

  let resp = await fetch('https://httpbin.org/bytes/60000'); // ~60kb response
  resp = await fetch('https://httpbin.org/bytes/50000'); // ~50kb response
  console.log(cacheStats());
```

### Disable caching

```javascript
  const { fetch } = require('@adobe/helix-fetch').noCache();

  let resp = await fetch('https://httpbin.org/cache/60'); // -> max-age=60 (seconds)
  // re-fetch
  resp = await fetch('https://httpbin.org/cache/60');
  assert(!resp.fromCache);
```

### Set a custom user agent

```javascript
  const { fetch } = require('@adobe/helix-fetch').context({
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

You can enable `helix-fetch` low-level debug console output by setting the `DEBUG` environment variable to `helix-fetch*`, e.g.:

```bash
$ DEBUG=helix-fetch* node test.js
```

This will produce console outout similar to:

```bash
  ...
  helix-fetch:core established TLS connection: #48 (www.nghttp2.org) +2s
  helix-fetch:core www.nghttp2.org -> h2 +0ms
  helix-fetch:h2 reusing socket #48 (www.nghttp2.org) +2s
  helix-fetch:h2 GET www.nghttp2.org/httpbin/user-agent +0ms
  helix-fetch:h2 session https://www.nghttp2.org established +1ms
  helix-fetch:h2 caching session https://www.nghttp2.org +0ms
  helix-fetch:h2 session https://www.nghttp2.org remoteSettings: {"headerTableSize":8192,"enablePush":true,"initialWindowSize":1048576,"maxFrameSize":16384,"maxConcurrentStreams":100,"maxHeaderListSize":4294967295,"maxHeaderSize":4294967295,"enableConnectProtocol":true} +263ms
  helix-fetch:h2 session https://www.nghttp2.org localSettings: {"headerTableSize":4096,"enablePush":true,"initialWindowSize":65535,"maxFrameSize":16384,"maxConcurrentStreams":4294967295,"maxHeaderListSize":4294967295,"maxHeaderSize":4294967295,"enableConnectProtocol":false} +0ms
  helix-fetch:h2 session https://www.nghttp2.org closed +6ms
  helix-fetch:h2 discarding cached session https://www.nghttp2.org +0ms
  ... 
```

Additionally, you can enable Node.js low-level debug console output by setting the `NODE_DEBUG` environment variable appropriately, e.g.

```bash
$ export NODE_DEBUG=http*,stream*
$ export DEBUG=helix-fetch*

$ node test.js
```

> Note: this will flood the console with highly verbose debug output.

## Acknowledgement

Thanks to [node-fetch](https://github.com/node-fetch/node-fetch) and [github/fetch](https://github.com/github/fetch) for providing a solid implementation reference.

## License

[Apache 2.0](LICENSE.txt)