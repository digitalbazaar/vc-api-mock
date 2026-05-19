import {createApp} from '../../src/server.js';
import {createStore} from '../../src/store/index.js';
import supertest from 'supertest';

/**
 * Returns a supertest-compatible agent pointed at either the local mock server
 * or a real VCALM server identified by VCALM_BASE_URL.
 *
 * Usage:
 *   VCALM_BASE_URL=https://real-server.example npm run test:conformance
 *
 * @returns {{
 *   agent: import('supertest').Agent | import('supertest').SuperTest<any>,
 *   isExternal: boolean
 * }}
 */
export function getAgent() {
  const baseUrl = process.env.VCALM_BASE_URL;
  if(baseUrl) {
    return {agent: supertest(baseUrl), isExternal: true};
  }
  const store = createStore();
  const app = createApp(store);
  return {agent: supertest(app), isExternal: false};
}

export const SAMPLE_CREDENTIAL = {
  '@context': ['https://www.w3.org/ns/credentials/v2'],
  type: ['VerifiableCredential'],
  issuer: 'did:example:conformance-issuer',
  validFrom: new Date().toISOString(),
  credentialSubject: {
    id: 'did:example:conformance-subject',
    name: 'Conformance Test Subject'
  }
};

export const SAMPLE_PRESENTATION = {
  '@context': ['https://www.w3.org/ns/credentials/v2'],
  type: ['VerifiablePresentation']
};
