<h1>Upgrade to helix-fetch v2.x</h1>

While helix-fetch v1.x was based on [fetch-h2](https://github.com/grantila/fetch-h2)
 v2.x is a complete re-implementation from scratch. The exposed API, options etc. have
 been aligned with [node-fetch](https://github.com/node-fetch/node-fetch) where possible.
 Due to the major changes there are numerous breaking changes both in the API and the options,
 which means that apps written for helix-fetch v1.x will most likely need to be updated to
 work with helix-fetch v2.x. This document helps you make this transition.

Note that this document is not an exhaustive list of all changes made in v2.x,
but rather that of the most important breaking changes. See our [ChangeLog](CHANGELOG.md)
for more information.

<!-- TOC --> 
- [API](#api)
- [Context options](#context-options)
- [Fetch options](#fetch-options)
- [Post JSON](#post-json)
- [Headers](#headers)
- [Response stream](#response-stream)
<!-- /TOC -->

---

## API

- ~~`disconnectAll()`~~ has been renamed to `reset()`.
- ~~`TimeoutError`~~ is no longer supported. `AbortError` is used instead.
- `fetch()` throws `FetchError`

## Context options

Forcing HTTP/1.1:

v1.x:

```js
const { fetch } = require('@adobe/helix-fetch').context({
    httpsProtocols: ['http1'],
  });
```

**=> v2.x:**

```js
const { fetch } = require('@adobe/helix-fetch').context({
    alpnProtocols: ['http/1.1']
  });
```

## Fetch options

The ~~`timeout`~~ option is no longer supported. Use the standard `signal` option instead.

## Post JSON

The ~~`json`~~ Fetch option is no longer supported. If `body` is a plain JS object it will be serialized as JSON and sent with `Content-Type: application/json`.

v1.x:

```js
const { fetch } = require('@adobe/helix-fetch');

const method = 'POST';
const json = { foo: 'bar' };
const resp = await fetch('https://httpbin.org/post', { method, json });
```

**=> v2.x:**

```js
const { fetch } = require('@adobe/helix-fetch');

const method = 'POST';
const body = { foo: 'bar' };
const resp = await fetch('https://httpbin.org/post', { method, body });
```

## Headers

The ~~`Headers#raw()`~~ method has been renamed to `Headers#plain()`.

## Response stream

The ~~`Response#readable()`~~ method is no longer supported. Use the `Response#body` property instead.

v1.x:

```js
const fs = require('fs');
const { fetch } = require('@adobe/helix-fetch');

const resp = await fetch('https://httpbin.org/image/jpeg');
(await resp.readable()).pipe(fs.createWriteStream('saved-image.jpg'));
```

**=> v2.x:**

```js
const fs = require('fs');
const { fetch } = require('@adobe/helix-fetch');

const resp = await fetch('https://httpbin.org/image/jpeg');
resp.body.pipe(fs.createWriteStream('saved-image.jpg'));
```
