import {
  computeMissing,
  SPEC_MANDATORY_POINTERS
} from '../../src/utils/pointers.js';
import {strict as assert} from 'node:assert';

describe('pointers', () => {
  describe('SPEC_MANDATORY_POINTERS', () => {
    it('should include required VC fields', () => {
      assert.ok(SPEC_MANDATORY_POINTERS.includes('/@context'));
      assert.ok(SPEC_MANDATORY_POINTERS.includes('/type'));
      assert.ok(SPEC_MANDATORY_POINTERS.includes('/issuer'));
      assert.ok(SPEC_MANDATORY_POINTERS.includes('/validFrom'));
    });
  });

  describe('computeMissing', () => {
    it('should return empty array when all mandatory pointers are covered',
      () => {
        const mandatory = /** @type {string[]} */ (['/issuer', '/validFrom']);
        const selective = /** @type {string[]} */ (
          ['/@context', '/type', '/issuer', '/validFrom',
            '/credentialSubject/name']
        );
        assert.deepEqual(computeMissing(mandatory, selective), []);
      });

    it('should return missing pointers when selective does not cover ' +
      'mandatory', () => {
      const mandatory = /** @type {string[]} */ (
        ['/issuer', '/validFrom', '/credentialStatus']
      );
      const selective = /** @type {string[]} */ (
        ['/@context', '/type', '/issuer']
      );
      const missing = computeMissing(mandatory, selective);
      assert.deepEqual(missing.sort(), ['/credentialStatus', '/validFrom']);
    });

    it('should always include spec-level mandatory pointers even if not in ' +
      'issuer mandatory', () => {
      const mandatory = /** @type {string[]} */ ([]);
      const selective = /** @type {string[]} */ (['/credentialSubject/name']);
      const missing = computeMissing(mandatory, selective);
      assert.ok(missing.includes('/@context'));
      assert.ok(missing.includes('/type'));
      assert.ok(missing.includes('/issuer'));
      assert.ok(missing.includes('/validFrom'));
    });

    it('should return empty array when selective covers all spec-level and ' +
      'issuer mandatory', () => {
      const mandatory = ['/credentialStatus'];
      const selective = [
        '/@context', '/type', '/issuer', '/validFrom', '/credentialStatus'
      ];
      assert.deepEqual(computeMissing(mandatory, selective), []);
    });

    it('should handle empty selective pointers', () => {
      const mandatory = /** @type {string[]} */ ([]);
      const selective = /** @type {string[]} */ ([]);
      const missing = computeMissing(mandatory, selective);
      assert.deepEqual(missing.sort(), [...SPEC_MANDATORY_POINTERS].sort());
    });
  });
});
