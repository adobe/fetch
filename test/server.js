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

'use strict';

const { readFile } = require('fs').promises;
const { randomBytes } = require('crypto');
const { fork } = require('child_process');
const http = require('http');
const https = require('https');
const http2 = require('http2');
const { promisify } = require('util');
const zlib = require('zlib');

const gzip = promisify(zlib.gzip);
const deflate = promisify(zlib.deflate);
const brotliCompress = promisify(zlib.brotliCompress);

const WOKEUP = 'woke up!';
const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms, WOKEUP);
});

const HELLO_WORLD = 'Hello, World!';

const writeChunked = (buf, out, chunkSize) => {
  let off = 0;
  let processed = 0;

  while (processed < buf.length) {
    out.write(buf.subarray(off, off + chunkSize));
    off += chunkSize;
    processed += chunkSize;
  }
};

// remove h2 headers (e.g. :path)
const sanitizeHeaders = (obj) => Object.fromEntries(Object.entries(obj)
  .map(([key, val]) => [key === ':authority' ? 'host' : key, val])
  .filter(([key, _]) => !key.startsWith(':')));

class Server {
  constructor(httpMajorVersion = 2, secure = true, helloMsg = HELLO_WORLD, options = {}) {
    if (![1, 2].includes(httpMajorVersion)) {
      throw new Error(`Unsupported httpMajorVersion: ${httpMajorVersion}`);
    }
    this.httpMajorVersion = httpMajorVersion;
    this.secure = secure;
    this.server = null;
    this.helloMsg = helloMsg;
    this.options = { ...options };
    this.connections = {};
    this.sessions = new Set();
  }

  async start(port = 0) {
    if (this.server) {
      throw Error('Server already started');
    }

    await new Promise((resolve, reject) => {
      const reqHandler = async (req, res) => {
        const { pathname, searchParams } = new URL(req.url, `https://localhost:${this.server.address().port}`);
        let count;
        const data = [];

        switch (pathname) {
          case '/status/200':
          case '/status/201':
          case '/status/202':
          case '/status/203':
          case '/status/204':
          case '/status/308':
          case '/status/500':
            await sleep(+(searchParams.get('delay') || 0));
            res.writeHead(+pathname.split('/')[2]);
            res.end();
            break;

          case '/hello':
            await sleep(+(searchParams.get('delay') || 0));
            res.writeHead(+(searchParams.get('status_code') || 200), { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(this.helloMsg);
            break;

          case '/cache':
            await sleep(+(searchParams.get('delay') || 0));
            res.writeHead(
              +(searchParams.get('status_code') || 200),
              {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': `public, max-age=${searchParams.get('max_age')}`,
              },
            );
            res.end(this.helloMsg);
            break;

          case '/cookies/set':
            res.statusCode = 200;
            searchParams.sort();
            res.setHeader('Set-Cookie', searchParams.toString().split('&'));
            res.end();
            break;

          case '/inspect':
            await sleep(+(searchParams.get('delay') || 0));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            req.on('data', (chunk) => {
              data.push(chunk);
            });
            req.on('end', () => {
              const buf = Buffer.concat(data);
              res.end(JSON.stringify({
                method: req.method,
                url: req.url,
                headers: sanitizeHeaders(req.headers),
                body: buf.toString(),
                base64Body: buf.toString('base64'),
              }));
            });
            break;

          case '/gzip':
            await sleep(+(searchParams.get('delay') || 0));
            res.writeHead(
              200,
              {
                'Content-Type': 'text/plain; charset=utf-8',
                'Content-Encoding': 'gzip',
              },
            );
            res.end(await gzip(this.helloMsg));
            break;

          case '/deflate':
            await sleep(+(searchParams.get('delay') || 0));
            res.writeHead(
              200,
              {
                'Content-Type': 'text/plain; charset=utf-8',
                'Content-Encoding': 'deflate',
              },
            );
            res.end(await deflate(this.helloMsg));
            break;

          case '/brotli':
            await sleep(+(searchParams.get('delay') || 0));
            res.writeHead(
              200,
              {
                'Content-Type': 'text/plain; charset=utf-8',
                'Content-Encoding': 'br',
              },
            );
            res.end(await brotliCompress(this.helloMsg));
            break;

          case '/abort':
            await sleep(+(searchParams.get('delay') || 0));
            // destroy current socket/session
            if (req.stream && req.stream.session) {
              // h2 server
              req.stream.session.destroy('aborted');
            } else {
              // h1 server
              req.socket.destroy();
            }
            break;

          case '/redirect-to':
            await sleep(+(searchParams.get('delay') || 0));
            res.writeHead(+(searchParams.get('status_code') || 302), { Location: searchParams.get('url') });
            res.end();
            break;

          case '/redirect/1':
          case '/redirect/2':
          case '/redirect/3':
          case '/redirect/4':
          case '/redirect/5':
            await sleep(+(searchParams.get('delay') || 0));
            count = +pathname.split('/')[2];
            if (count > 1) {
              res.writeHead(302, { Location: `/redirect/${count - 1}` });
            } else {
              res.writeHead(302, { Location: '/hello' });
            }
            res.end();
            break;

          case '/bytes':
            await sleep(+(searchParams.get('delay') || 0));
            count = +(searchParams.get('count') || 32);
            res.writeHead(200, {
              'Content-Type': 'application/octet-stream',
              'Content-Length': `${count}`,
            });
            res.end(randomBytes(count));
            break;

          case '/stream-bytes':
            await sleep(+(searchParams.get('delay') || 0));
            count = +(searchParams.get('count') || 32);
            res.writeHead(200, {
              'Content-Type': 'application/octet-stream',
            });
            writeChunked(randomBytes(count), res, 128);
            res.end();
            break;

          default:
            res.writeHead(404);
            res.end('Not found');
        }
      };

      const createServer = async (handler) => {
        let options = {};
        if (this.secure) {
          const keys = JSON.parse(await readFile(`${__dirname}/keys.json`));
          options = { ...keys };
        }
        // merge with user-provided options
        options = { ...options, ...this.options };

        if (this.httpMajorVersion === 1) {
          return this.secure
            ? https.createServer(options, handler) : http.createServer(options, handler);
        } else {
          return this.secure
            ? http2.createSecureServer(options, handler) : http2.createServer(options, handler);
        }
      };
      let resolved = false;
      createServer(reqHandler)
        .then((server) => {
          server.listen(port)
            .on('error', (err) => {
              if (!resolved) {
                reject(err);
              }
            })
            .on('close', () => {
              this.server = null;
              this.sessions.clear();
            })
            .on('connection', (conn) => {
              const key = `${conn.remoteAddress}:${conn.remotePort}`;
              this.connections[key] = conn;
              conn.on('close', () => {
                delete this.connections[key];
              });
            })
            .on('session', (session) => {
              // h2 specific
              this.sessions.add(session);
              session.on('close', () => {
                this.sessions.delete(session);
              });
            })
            .on('listening', () => {
              this.server = server;
              resolve();
              resolved = true;
            });
        });
    });
  }

  get port() {
    if (!this.server) {
      throw Error('Server not started');
    }
    return this.server.address().port;
  }

  get origin() {
    const { port } = this;
    // eslint-disable-next-line no-nested-ternary
    const proto = this.secure ? 'https' : (this.httpMajorVersion === 2 ? 'http2' : 'http');
    return `${proto}://localhost:${port}`;
  }

  async shutDown(force = false) {
    if (!this.server) {
      throw Error('server not started');
    }
    if (this.sessions.size) {
      // h2 specific
      this.sessions.forEach((session) => {
        if (force) {
          session.destroy();
        } else {
          session.close();
        }
      });
    }
    Object.keys(this.connections).forEach((key) => {
      if (force) {
        this.connections[key].destroy();
      } else {
        this.connections[key].end();
      }
    });
    return new Promise((resolve, reject) => {
      this.server.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async destroy() {
    return this.shutDown(true);
  }

  async close() {
    return this.shutDown(false);
  }

  async restart() {
    if (!this.server) {
      throw Error('server not started');
    }
    const { port } = this;
    await this.destroy();
    return this.start(port);
  }

  // eslint-disable-next-line max-len
  static async launch(httpMajorVersion = 2, secure = true, helloMsg = HELLO_WORLD, port = 0, options = {}) {
    const childProcess = fork(`${__dirname}/runServer.js`);
    return new Promise((resolve, reject) => {
      childProcess.send(
        {
          httpMajorVersion, secure, helloMsg, port, options,
        },
        (err) => {
          if (err) {
            reject(err);
          }
        },
      );
      childProcess.on('message', (msg) => {
        // const { pid, port, origin } = msg;
        resolve(msg);
      });
    });
  }
}

module.exports = { Server };
