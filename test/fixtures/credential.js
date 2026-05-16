/**
 * Sample unsigned credential fixture for tests.
 * @returns {object}
 */
export function unsignedCredential() {
  return {
    '@context': ['https://www.w3.org/ns/credentials/v2'],
    type: ['VerifiableCredential'],
    issuer: 'did:example:issuer',
    validFrom: '2024-01-01T00:00:00Z',
    credentialSubject: {
      id: 'did:example:alice',
      name: 'Alice Smith',
      birthCountry: 'US',
      alumniOf: 'University of Example'
    }
  };
}

/**
 * Sample unsigned credential with BBS+ cryptosuite hint for derive tests.
 * @returns {object}
 */
export function bbsCredential() {
  return {
    '@context': ['https://www.w3.org/ns/credentials/v2'],
    type: ['VerifiableCredential'],
    issuer: 'did:example:issuer',
    validFrom: '2024-01-01T00:00:00Z',
    credentialSubject: {
      id: 'did:example:alice',
      name: 'Alice Smith',
      birthCountry: 'US',
      age: 30
    }
  };
}
