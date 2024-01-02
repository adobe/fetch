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
/* eslint-disable no-unused-expressions */
/* eslint-disable guard-for-in */

import { expect, use } from 'chai';
import chaiIterator from 'chai-iterator';

import { Headers } from '../../src/index.js';

use(chaiIterator);
// const { expect } = chai;

describe('Headers Tests', () => {
  it('overrides toStringTag', () => {
    const headers = new Headers();
    expect(Object.prototype.toString.call(headers)).to.be.equal('[object Headers]');
  });

  it('should have attributes conforming to Web IDL', () => {
    const headers = new Headers();
    expect(Object.getOwnPropertyNames(headers)).to.be.empty;
    const enumerableProperties = [];

    // eslint-disable-next-line no-restricted-syntax
    for (const property in headers) {
      enumerableProperties.push(property);
    }

    for (const toCheck of [
      'append',
      'delete',
      'entries',
      'forEach',
      'get',
      'has',
      'keys',
      'set',
      'values',
    ]) {
      expect(enumerableProperties).to.contain(toCheck);
    }
  });

  it('should allow iterating through all headers with forEach', () => {
    const headers = new Headers([
      ['b', '2'],
      ['c', '4'],
      ['b', '3'],
      ['a', '1'],
      ['d', ['5', '6']],
    ]);
    expect(headers).to.have.property('forEach');

    const result = [];
    headers.forEach((value, key) => {
      result.push([key, value]);
    });

    expect(result).to.deep.equal([
      ['a', '1'],
      ['b', '2, 3'],
      ['c', '4'],
      ['d', '5, 6'],
    ]);
  });

  it('should allow iterating through all headers with for-of loop', () => {
    const headers = new Headers([
      ['b', '2'],
      ['c', '4'],
      ['a', '1'],
    ]);
    headers.append('b', '3');
    expect(headers).to.be.iterable;

    const result = [];
    for (const pair of headers) {
      result.push(pair);
    }

    expect(result).to.deep.equal([
      ['a', '1'],
      ['b', '2, 3'],
      ['c', '4'],
    ]);
  });

  it('should allow iterating through all headers with entries()', () => {
    const headers = new Headers([
      ['b', '2'],
      ['c', '4'],
      ['a', '1'],
    ]);
    headers.append('b', '3');

    expect(headers.entries()).to.be.iterable
      .and.to.deep.iterate.over([
        ['a', '1'],
        ['b', '2, 3'],
        ['c', '4'],
      ]);
  });

  it('should allow iterating through all headers with keys()', () => {
    const headers = new Headers([
      ['b', '2'],
      ['c', '4'],
      ['a', '1'],
    ]);
    headers.append('b', '3');

    expect(headers.keys()).to.be.iterable
      .and.to.iterate.over(['a', 'b', 'c']);
  });

  it('should allow iterating through all headers with values()', () => {
    const headers = new Headers([
      ['b', '2'],
      ['c', '4'],
      ['a', '1'],
    ]);
    headers.append('b', '3');

    expect(headers.values()).to.be.iterable
      .and.to.iterate.over(['1', '2, 3', '4']);
  });

  it('should reject illegal header', () => {
    const headers = new Headers();
    expect(() => new Headers({ 'He y': 'ok' })).to.throw(TypeError);
    expect(() => new Headers({ 'Hé-y': 'ok' })).to.throw(TypeError);
    expect(() => new Headers({ 'He-y': 'ăk' })).to.throw(TypeError);
    expect(() => headers.append('Hé-y', 'ok')).to.throw(TypeError);
    expect(() => headers.delete('Hé-y')).to.throw(TypeError);
    expect(() => headers.get('Hé-y')).to.throw(TypeError);
    expect(() => headers.has('Hé-y')).to.throw(TypeError);
    expect(() => headers.set('Hé-y', 'ok')).to.throw(TypeError);
    // Should reject empty header
    expect(() => headers.append('', 'ok')).to.throw(TypeError);
    // Should repoort header name in error
    expect(() => new Headers({ 'Faulty-Header': 'ăk' })).to.throw(/Faulty-Header/);
  });

  it('constructor should support plain object', () => {
    const headers = new Headers({ foo: 'bar', 'x-cookies': ['a=1', 'b=2'] });
    expect(headers.get('foo')).to.be.equal('bar');
    expect(headers.get('x-cookies')).to.be.equal('a=1, b=2');
  });

  it('get should return null if not found', () => {
    const headers = new Headers();
    expect(headers.get('not-found')).to.be.null;
  });

  it('should coerce name to string', () => {
    const headers = new Headers();
    expect(() => headers.set(true, 'ok')).to.not.throw();
    expect(headers.get(true)).to.be.equal('ok');
    expect(headers.get('true')).to.be.equal('ok');
  });

  it('should coerce value to string', () => {
    const headers = new Headers();
    const vals = [true, [1, 2, 3], 42, null, undefined];

    for (const val of vals) {
      expect(() => headers.set('a', val)).to.not.throw();
      expect(headers.get('a')).to.be.equal(String(val));
    }
  });

  it('plain() should return plain object representation', () => {
    const hdrObj = { foo: 'bar', 'x-cookies': ['a=1', 'b=2'] };
    const headers = new Headers(hdrObj);
    expect(headers.plain()).to.be.deep.equal({ foo: 'bar', 'x-cookies': 'a=1, b=2' });
  });

  it('raw() should return multi-valued headers as array of strings', () => {
    const hdrObj = { foo: 'bar', 'x-cookies': ['a=1', 'b=2'] };
    const headers = new Headers(hdrObj);
    expect(headers.raw()).to.be.deep.equal(hdrObj);
  });

  it('should support multi-valued headers (e.g. Set-Cookie)', () => {
    let headers = new Headers();
    headers.append('set-cookie', 't=1; Secure');
    headers.append('set-cookie', 'u=2; Secure');
    expect(headers.get('set-cookie')).to.be.equal('t=1; Secure, u=2; Secure');
    expect(headers.plain()['set-cookie']).to.be.deep.equal('t=1; Secure, u=2; Secure');
    expect(headers.raw()['set-cookie']).to.be.deep.equal(['t=1; Secure', 'u=2; Secure']);

    headers = new Headers(headers);
    expect(headers.get('set-cookie')).to.be.equal('t=1; Secure, u=2; Secure');
    expect(headers.plain()['set-cookie']).to.be.deep.equal('t=1; Secure, u=2; Secure');
    expect(headers.raw()['set-cookie']).to.be.deep.equal(['t=1; Secure', 'u=2; Secure']);
  });
});
