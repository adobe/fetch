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

/* eslint-env mocha */
/* eslint-disable guard-for-in */
/* eslint-disable no-unused-expressions */

'use strict';

const { Readable } = require('stream');

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);

const { expect } = chai;

const { Response } = require('../../src/fetch');

describe('Response Tests', () => {
  it('overrides toStringTag', () => {
    const res = new Response();
    expect(Object.prototype.toString.call(res)).to.be.equal('[object Response]');
  });

  it('should have attributes conforming to Web IDL', () => {
    const res = new Response();
    const enumerableProperties = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const property in res) {
      enumerableProperties.push(property);
    }

    for (const toCheck of [
      'body',
      'bodyUsed',
      'arrayBuffer',
      'json',
      'text',
      'url',
      'status',
      'ok',
      'redirected',
      'statusText',
      'headers',
      'clone',
    ]) {
      expect(enumerableProperties).to.contain(toCheck);
    }

    for (const toCheck of [
      'body',
      'bodyUsed',
      'url',
      'status',
      'ok',
      'redirected',
      'statusText',
      'headers',
    ]) {
      expect(() => {
        res[toCheck] = 'abc';
      }).to.throw();
    }
  });

  it('should support empty options', () => {
    const res = new Response(Readable.from('a=1'));
    return res.text().then((result) => {
      expect(result).to.equal('a=1');
    });
  });

  it('should support parsing headers', () => {
    const res = new Response(null, {
      headers: {
        a: '1',
      },
    });
    expect(res.headers.get('a')).to.equal('1');
  });

  it('should support text() method', () => {
    const res = new Response('a=1');
    return res.text().then((result) => {
      expect(result).to.equal('a=1');
    });
  });

  it('should support json() method', () => {
    const res = new Response('{"a":1}');
    return res.json().then((result) => {
      expect(result.a).to.equal(1);
    });
  });

  it('should support buffer() method', () => {
    const res = new Response('a=1');
    return res.buffer().then((result) => {
      expect(result.toString()).to.equal('a=1');
    });
  });

  it('should support clone() method', () => {
    const body = Readable.from('a=1');
    const res = new Response(body, {
      headers: {
        a: '1',
      },
      url: 'http://example.com/',
      status: 346,
      statusText: 'production',
    });
    const cl = res.clone();
    expect(cl.headers.get('a')).to.equal('1');
    expect(cl.url).to.equal('http://example.com/');
    expect(cl.status).to.equal(346);
    expect(cl.statusText).to.equal('production');
    expect(cl.ok).to.be.false;
    // Clone body shouldn't be the same body
    expect(cl.body).to.not.equal(body);
    return cl.text().then((result) => {
      expect(result).to.equal('a=1');
    });
  });

  it('clone() should throw if body is already consumed', () => {
    const body = Readable.from('a=1');
    const res = new Response(body);
    const clone = () => res.clone();
    return res.text().then((result) => {
      expect(result).to.be.equal('a=1');
      expect(clone).to.throw(TypeError);
    });
  });

  it('should support stream as body', () => {
    const body = Readable.from('a=1');
    const res = new Response(body);
    return res.text().then((result) => {
      expect(result).to.equal('a=1');
    });
  });

  it('should support string as body', () => {
    const res = new Response('a=1');
    return res.text().then((result) => {
      expect(result).to.equal('a=1');
    });
  });

  it('should support String as body', () => {
    // eslint-disable-next-line no-new-wrappers
    const res = new Response(new String('a=1'));
    return res.text().then((result) => {
      expect(result).to.equal('a=1');
    });
  });

  it('should coerce body to string', () => {
    const res = new Response(true);
    return res.text().then((result) => {
      expect(result).to.equal('true');
    });
  });

  it('should support buffer as body', () => {
    const res = new Response(Buffer.from('a=1'));
    return res.text().then((result) => {
      expect(result).to.equal('a=1');
    });
  });

  it('should default to null as body', () => {
    const res = new Response();
    expect(res.body).to.equal(null);

    return res.text().then((result) => expect(result).to.equal(''));
  });

  it('should default to 200 as status code', () => {
    const res = new Response(null);
    expect(res.status).to.equal(200);
  });

  it('should default to empty string as url', () => {
    const res = new Response();
    expect(res.url).to.equal('');
  });

  it('should reject if error on stream', () => {
    const stream = Readable.from('a=1');
    const res = new Response(stream);
    stream.emit('error', new Error('test'));
    expect(res.text()).to.be.rejectedWith(TypeError);
  });

  it('should set bodyUsed', () => {
    const res = new Response(Readable.from('a=1'));
    expect(res.bodyUsed).to.be.false;
    return res.text().then((result) => {
      expect(res.bodyUsed).to.be.true;
      expect(result).to.equal('a=1');
    });
  });

  it('should reject if bodyUsed', () => {
    const res = new Response(Readable.from('a=1'));
    expect(res.bodyUsed).to.be.false;
    return res.text().then(async (result) => {
      expect(res.bodyUsed).to.be.true;
      expect(result).to.equal('a=1');
      // repeated access should fail
      expect(res.text()).to.be.rejectedWith(TypeError);
    });
  });

  it('redirect creates redirect Response', () => {
    const res = Response.redirect('https://fetch.spec.whatwg.org/', 301);
    expect(res).to.be.an.instanceof(Response);
    expect(res.status).to.equal(301);
    expect(res.headers.get('Location')).to.equal('https://fetch.spec.whatwg.org/');
  });

  it('redirect defaults to redirect status 302', () => {
    const res = Response.redirect('https://fetch.spec.whatwg.org/');
    expect(res).to.be.an.instanceof(Response);
    expect(res.status).to.equal(302);
    expect(res.headers.get('Location')).to.equal('https://fetch.spec.whatwg.org/');
  });

  it('redirect throws on non-redirect status', () => {
    const redirect = () => Response.redirect('https://fetch.spec.whatwg.org/', 200);
    expect(redirect).to.throw(RangeError);
  });
});
