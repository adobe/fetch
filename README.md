# Helix Fetch Library

> Library for making transparent HTTP/1(.1) and HTTP/2 requests.

Based on [fetch-h2](https://github.com/grantila/fetch-h2).

## Features

- [x] [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) implementation 
- [x] Transparent handling of HTTP/1(.1) and HTTP/2 connections
- [x] Promise API/`async & await`
- [x] Streaming support
- [x] [RFC 7234](https://httpwg.org/specs/rfc7234.html) compliant cache
- [x] HTTP/2 request and response multiplexing support
- [x] HTTP/2 Server Push support

## Status

[![codecov](https://img.shields.io/codecov/c/github/stefan-guggisberg/helix-fetch.svg)](https://codecov.io/gh/stefan-guggisberg/helix-fetch)
[![CircleCI](https://img.shields.io/circleci/project/github/stefan-guggisberg/helix-fetch.svg)](https://circleci.com/gh/stefan-guggisberg/helix-fetch)
[![GitHub license](https://img.shields.io/github/license/stefan-guggisberg/helix-fetch.svg)](https://github.com/stefan-guggisberg/helix-fetch/blob/master/LICENSE.txt)
[![GitHub issues](https://img.shields.io/github/issues/stefan-guggisberg/helix-fetch.svg)](https://github.com/stefan-guggisberg/helix-fetch/issues)
[![LGTM Code Quality Grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/stefan-guggisberg/helix-fetch.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/stefan-guggisberg/helix-fetch)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

## Installation

```bash
$ npm install @adobe/helix-fetch
```

## Usage Examples

### Fetch JSON

```javascript
  const { fetch } = require('helix-fetch');

  const resp = await fetch('https://httpbin.org/json');
  const jsonData = await resp.json();
```

### Fetch text data

```javascript
  const { fetch } = require('helix-fetch');

  const resp = await fetch('https://httpbin.org/');
  const textData = await resp.text();
```

### Fetch binary data

```javascript
  const { fetch } = require('helix-fetch');

  const resp = await fetch('https://httpbin.org//stream-bytes/65535');
  const imageData = await resp.arrayBuffer();
```

### Stream an image

```javascript
  const fs = require('fs');
  const { fetch } = require('helix-fetch');

  const resp = await fetch('https://httpbin.org/image/jpeg');
  (await resp.readable()).pipe(fs.createWriteStream('saved-image.jpg'));
```

### Post JSON

```javascript
  const { fetch } = require('helix-fetch');

  const method = 'POST';
  const json = { foo: 'bar' };
  const resp = await fetch('https://httpbin.org/post', { method, json });
```

### Post JPEG image

```javascript
  const fs = require('fs');
  const { fetch } = require('helix-fetch');

  const method = 'POST';
  const body = fs.createReadStream('some-image.jpg');
  const headers = { 'content-type': 'image/jpeg' };
  const resp = await fetch('https://httpbin.org/post', { method, body, headers });
```

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
