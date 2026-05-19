import {
  generateProof,
  MOCK_VERIFICATION_METHOD,
  verifyProof
} from '../../src/utils/proof.js';
import {strict as assert} from 'node:assert';

const sampleCredential = {
  '@context': ['https://www.w3.org/ns/credentials/v2'],
  type: ['VerifiableCredential'],
  issuer: 'did:example:issuer',
  validFrom: '2024-01-01T00:00:00Z',
  credentialSubject: {id: 'did:example:alice', name: 'Alice'}
};

describe('proof', () => {
  describe('generateProof', () => {
    it('should return a DataIntegrityProof object', () => {
      const proof = generateProof(sampleCredential);
      assert.equal(proof.type, 'DataIntegrityProof');
    });

    it('should use eddsa-rdfc-2022 cryptosuite', () => {
      const proof = generateProof(sampleCredential);
      assert.equal(proof.cryptosuite, 'eddsa-rdfc-2022');
    });

    it('should set proofPurpose to assertionMethod', () => {
      const proof = generateProof(sampleCredential);
      assert.equal(proof.proofPurpose, 'assertionMethod');
    });

    it('should set verificationMethod to mock DID', () => {
      const proof = generateProof(sampleCredential);
      assert.equal(proof.verificationMethod, MOCK_VERIFICATION_METHOD);
    });

    it('should set proofValue starting with mock-proof-', () => {
      const proof = generateProof(sampleCredential);
      assert.ok(proof.proofValue?.startsWith('mock-proof-'));
    });

    it('should include a created timestamp', () => {
      const proof = generateProof(sampleCredential);
      assert.ok(typeof proof.created === 'string');
      assert.ok(new Date(proof.created).getTime() > 0);
    });

    it('should produce deterministic proofValue for same input', () => {
      const p1 = generateProof(sampleCredential);
      const p2 = generateProof(sampleCredential);
      assert.equal(p1.proofValue, p2.proofValue);
    });
  });

  describe('verifyProof', () => {
    it('should return true for a valid mock proof', () => {
      const vc = {...sampleCredential, proof: generateProof(sampleCredential)};
      assert.equal(verifyProof(vc), true);
    });

    it('should return false when proof is missing', () => {
      assert.equal(verifyProof(sampleCredential), false);
    });

    it('should return false when proof type is wrong', () => {
      const vc = {
        ...sampleCredential,
        proof: {
          ...generateProof(sampleCredential), type: 'SomeOtherProof'
        }
      };
      assert.equal(verifyProof(vc), false);
    });

    it('should return false when proofValue does not start with mock-proof-',
      () => {
        const vc = {
          ...sampleCredential,
          proof: {
            ...generateProof(sampleCredential), proofValue: 'tampered-value'
          }
        };
        assert.equal(verifyProof(vc), false);
      });
  });
});
