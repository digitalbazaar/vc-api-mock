import {createHash} from 'node:crypto';

/** @typedef {import('../types.js').Proof} Proof */
/** @typedef {import('../types.js').VerifiableCredential} VerifiableCredential */
/** @typedef {import('../types.js').VerifiablePresentation} VerifiablePresentation */
/** @typedef {Record<string, unknown> & {proof?: Proof}} HasProof */

export const MOCK_VERIFICATION_METHOD = 'did:example:mock#key-1';

/**
 * Generates a deterministic fake proof for a credential or presentation.
 * Does NOT perform real cryptography — for mock/testing use only.
 *
 * @param {HasProof} document
 * @returns {Proof}
 */
export function generateProof(document) {
  const hash = createHash('sha256')
    .update(JSON.stringify(document))
    .digest('hex');
  return {
    type: 'DataIntegrityProof',
    cryptosuite: 'eddsa-rdfc-2022',
    verificationMethod: MOCK_VERIFICATION_METHOD,
    created: new Date().toISOString(),
    proofPurpose: 'assertionMethod',
    proofValue: `mock-proof-${hash}`
  };
}

/**
 * Verifies that a document has a valid mock proof.
 *
 * @param {HasProof} document
 * @returns {boolean}
 */
export function verifyProof(document) {
  const {proof} = document;
  if(!proof) {
    return false;
  }
  if(proof.type !== 'DataIntegrityProof') {
    return false;
  }
  if(!proof.proofValue?.startsWith('mock-proof-')) {
    return false;
  }
  return true;
}
