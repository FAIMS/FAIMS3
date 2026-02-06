import {expect} from 'chai';
import {simpleHash} from '../src/couchdb/export/utils';

describe('simpleHash', () => {
  it('returns deterministic results', () => {
    const result1 = simpleHash('hello123!?', 8);
    const result2 = simpleHash('hello123!?', 8);
    expect(result1).to.equal(result2);
  });

  it('returns string of requested length', () => {
    expect(simpleHash('test', 4)).to.have.lengthOf(4);
    expect(simpleHash('test', 6)).to.have.lengthOf(6);
    expect(simpleHash('test', 8)).to.have.lengthOf(8);
  });

  it('returns valid hex characters only', () => {
    const result = simpleHash('anything', 8);
    expect(result).to.match(/^[0-9a-f]+$/);
  });

  it('produces different hashes for different inputs', () => {
    const a = simpleHash('file_a.txt', 8);
    const b = simpleHash('file_b.txt', 8);
    expect(a).to.not.equal(b);
  });

  it('handles empty string input', () => {
    const result = simpleHash('', 8);
    expect(result).to.have.lengthOf(8);
    expect(result).to.match(/^[0-9a-f]+$/);
  });

  it('truncates when length is shorter than full hash', () => {
    const short = simpleHash('test', 4);
    const full = simpleHash('test', 8);
    expect(full.startsWith(short)).to.be.true;
  });

  it('pads with zeros when length exceeds 8 hex chars', () => {
    const result = simpleHash('test', 12);
    expect(result).to.have.lengthOf(12);
    // Should have leading zeros since djb2 only produces 32-bit (8 hex chars)
    expect(result).to.match(/^0+[0-9a-f]+$/);
  });

  it('handles long input strings', () => {
    const longStr = 'a'.repeat(10000);
    const result = simpleHash(longStr, 8);
    expect(result).to.have.lengthOf(8);
    expect(result).to.match(/^[0-9a-f]+$/);
  });

  it('is sensitive to small input changes', () => {
    const a = simpleHash('test1', 8);
    const b = simpleHash('test2', 8);
    expect(a).to.not.equal(b);
  });
});
