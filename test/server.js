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
const http = require('http');
const https = require('https');
const http2 = require('http2');

const WOKEUP = 'woke up!';
const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms, WOKEUP);
});

const HELLO_WORLD = 'Hello, World!';

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
        switch (pathname) {
          case '/hello':
            await sleep(+(searchParams.get('delay') || 0));
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(this.helloMsg);
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
            res.writeHead(searchParams.get('status_code') || 302, { Location: searchParams.get('url') });
            res.end(this.helloMsg);
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
}

module.exports = { Server };
