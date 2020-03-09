# Helix Fetch Library

> Library for making transparent HTTP/1(.1) and HTTP/2 requests.

`helix-fetch` is based on [fetch-h2](https://github.com/grantila/fetch-h2). `helix-fetch` in general adheres to the [Fetch API Specification](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API), implementing a subset of the API. However, there are some notable deviations:

* `Response.body` is not implemented. Use `Response.readable()` instead.
* `Response.blob()` is not implemented. Use `Response.buffer()` instead.
* `Response.formData()` is not implemented.
* The following `fetch()` options are ignored since `helix-fetch` doesn't have the concept of web pages: `mode`, `referrer` and `referrerPolicy`.

`helix-fetch` also supports the following extensions:

* `Response.buffer()` returns a Node.js `Buffer`.
* The `body` that can be sent in a `Request` can also be a `Readable` Node.js stream, a `Buffer` or a string.
* `fetch()` has an extra option, `json` that can be used instead of `body` to send an object that will be JSON stringified. The appropriate content-type will be set if it isn't already.
* `fetch()` has an extra option, `timeout` which is a timeout in milliseconds before the request should be aborted and the returned promise thereby rejected (with a `TimeoutError`).
* The `Response` object has an extra property `httpVersion` which is either `1` or `2` (numbers), depending on what was negotiated with the server.
* `Response.headers.raw()` returns the headers as a plain object.

## Features

* [x] [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) implementation
* [x] Transparent handling of HTTP/1(.1) and HTTP/2 connections
* [x] Promise API/`async & await`
* [x] Streaming support
* [x] [RFC 7234](https://httpwg.org/specs/rfc7234.html) compliant cache
* [x] HTTP/2 request and response multiplexing support
* [x] HTTP/2 Server Push support

## Status

[![codecov](https://img.shields.io/codecov/c/github/adobe/helix-fetch.svg)](https://codecov.io/gh/adobe/helix-fetch)
[![CircleCI](https://img.shields.io/circleci/project/github/adobe/helix-fetch.svg)](https://circleci.com/gh/adobe/helix-fetch)
[![GitHub license](https://img.shields.io/github/license/adobe/helix-fetch.svg)](https://github.com/adobe/helix-fetch/blob/master/LICENSE.txt)
[![GitHub issues](https://img.shields.io/github/issues/adobe/helix-fetch.svg)](https://github.com/adobe/helix-fetch/issues)
[![LGTM Code Quality Grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/adobe/helix-fetch.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/adobe/helix-fetch)
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
  console.log(resp.headers.raw());
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

### Stream an image

```javascript
  const fs = require('fs');
  const { fetch } = require('@adobe/helix-fetch');

  const resp = await fetch('https://httpbin.org/image/jpeg');
  (await resp.readable()).pipe(fs.createWriteStream('saved-image.jpg'));
```

### Post JSON

```javascript
  const { fetch } = require('@adobe/helix-fetch');

  const method = 'POST';
  const json = { foo: 'bar' };
  const resp = await fetch('https://httpbin.org/post', { method, json });
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

### GET with query parameters object

```javascript

const { fetch } = require('@adobe/helix-fetch');

const qs = {
  helix: 'dummy',
  foo: 'bar',
  rumple: "stiltskin",
};

const resp = await fetch('https://httpbin.org/json', {qs});
```

### HTTP/2 Server Push

```javascript
  const { fetch, onPush } = require('@adobe/helix-fetch');

  onPush((url) => console.log(`received server push: ${url}`));

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
  const { fetch } = require('@adobe/helix-fetch').context({
    httpsProtocols: ['http1'],
  });

  const resp = await fetch('https://nghttp2.org');
  console.log(`Http version: ${resp.httpVersion}`);
```

See [Contexts](https://github.com/grantila/fetch-h2#contexts) for more options.

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
