# Helix Fetch Library

> Lightweight Fetch implementation transparently supporting both HTTP/1(.1) and HTTP/2.

`helix-fetch` in general adheres to the [Fetch API Specification](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API), implementing a subset of the API. However, there are some notable deviations:

* `Response.body` returns a Node.js [Readable stream](https://nodejs.org/api/stream.html#stream_readable_streams).
* `Response.blob()` is not implemented. Use `Response.buffer()` instead.
* `Response.formData()` is not implemented.
* The following `fetch()` options are ignored due to the nature of Node.js and since `helix-fetch` doesn't have the concept of web pages: `mode`, `referrer`, `referrerPolicy` `integrity`, `credentials` and `keepalive`.

`helix-fetch` also supports the following extensions:

* `Response.buffer()` returns a Node.js `Buffer`.
* The `body` that can be sent in a `Request` can also be a `Readable` Node.js stream, a `Buffer`, a string or a plain object.
* The `Response` object has an extra property `httpVersion` which is one of `'1.0'`, `'1.1'` or `'2.0'` (numbers), depending on what was negotiated with the server.
* The `Response` object has an extra property `fromCache` which determines whether the response was retrieved from cache.
* `Response.headers.plain()` returns the headers as a plain object.

## Features

* [x] supports reasonable subset of the standard [Fetch specification](https://fetch.spec.whatwg.org/)
* [x] Transparent handling of HTTP/1(.1) and HTTP/2 connections
* [x] [RFC 7234](https://httpwg.org/specs/rfc7234.html) compliant cache
* [x] Support `gzip/deflate/br` content encoding
* [x] HTTP/2 request and response multiplexing support
* [x] HTTP/2 Server Push support (transparent caching and explicit listener support)
* [x] overridable User-Agent
* [x] low-level HTTP/1.* agent/connect options support (e.g. `keepAlive`, `rejectUnauthorized`)

## Status

[![codecov](https://img.shields.io/codecov/c/github/adobe/helix-fetch.svg)](https://codecov.io/gh/adobe/helix-fetch)
[![CircleCI](https://img.shields.io/circleci/project/github/adobe/helix-fetch.svg)](https://circleci.com/gh/adobe/helix-fetch)
[![GitHub license](https://img.shields.io/github/license/adobe/helix-fetch.svg)](https://github.com/adobe/helix-fetch/blob/main/LICENSE.txt)
[![GitHub issues](https://img.shields.io/github/issues/adobe/helix-fetch.svg)](https://github.com/adobe/helix-fetch/issues)
[![LGTM Code Quality Grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/adobe/helix-fetch.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/adobe/helix-fetch)
[![Renovate enabled](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovatebot.com/)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

## Installation

```bash
$ npm install @adobe/helix-fetch
```

## Usage Examples

### Access Response Headers and other Meta data

```javascript
  const { fetch } = require('@adobe/helix-fetch');

  const resp = await fetch('https://httpbin.org/get');
  console.log(resp.ok);
  console.log(resp.status);
  console.log(resp.statusText);
  console.log(resp.method);
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

Using `signalTimeout(ms)` extension:

```javascript
  const { fetch, timeoutSignal, AbortError } = require('@adobe/helix-fetch');

  try {
    const resp = await fetch('https://httpbin.org/json', { signal: timeoutSignal(1000) });
    const jsonData = await resp.json();
  } catch (err) {
    if (err instanceof AbortError) {
      console.log('fetch timed out after 1s');
    }
  }
```

Using `AbortController`:

```javascript
  const { fetch, AbortController, AbortError } = require('@adobe/helix-fetch');

  const controller = new AbortController();
  setTimeout(() => controller.abort(), 1000);
  const { signal } = controller;

  try {
    const resp = await fetch('https://httpbin.org/json', { signal });
    const jsonData = await resp.json();
  } catch (err) {
    if (err instanceof AbortError) {
      console.log('fetch timed out after 1s');
    }
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
  const fs = require('fs');
  const { FormData, fetch } = require('@adobe/helix-fetch');

  const method = 'POST';
  const body = new FormData();
  body.append('foo', 'bar');
  body.append('data', [ 0x68, 0x65, 0x6c, 0x69, 0x78, 0x2d, 0x66, 0x65, 0x74, 0x63, 0x68 ]);
  body.append('some_file', fs.createReadStream('/foo/bar.jpg'), 'bar.jpg');
  const resp = await fetch('https://httpbin.org/post', { method, body });
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

### HTTP/2 Server Push

Note that pushed resources will be automatically and transparently added to the cache.
You can however add a listener which will be notified on every pushed (and cached) resource.

```javascript
  const { fetch, onPush } = require('@adobe/helix-fetch');

  onPush((url, response) => console.log(`received server push: ${url} status ${response.status}`));

  const resp = await fetch('https://nghttp2.org');
  console.log(`Http version: ${resp.httpVersion}`);
```

### Customization

Set cache size limit (Default: 100 \* 1024 \* 1024 bytes, i.e. 100mb):

```javascript
  const { fetch, cacheStats } = require('@adobe/helix-fetch').context({
    maxCacheSize: 100 * 1024, // 100kb
  });

  let resp = await fetch('http://httpbin.org/bytes/60000'); // ~60kb response
  resp = await fetch('http://httpbin.org/bytes/50000'); // ~50kb response
  console.log(cacheStats());
```

Force HTTP/1(.1) protocol:

```javascript
  const { fetch, ALPN_HTTP1_1 } = require('@adobe/helix-fetch').context({
    alpnProtocols: [ALPN_HTTP1_1],
  });

  const resp = await fetch('https://nghttp2.org');
  console.log(`Http version: ${resp.httpVersion}`);
```

### Misc

More example code can be found [here](/test/index.test.js).

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
