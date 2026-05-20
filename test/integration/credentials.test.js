import {bbsCredential, unsignedCredential} from '../fixtures/credential.js';
import {strict as assert} from 'node:assert';
import {createApp} from '../../src/server.js';
import {createStore} from '../../src/store/index.js';

import request from 'supertest';

describe('POST /credentials/issue', () => {
  /** @type {import('express').Application} */ let app;
  /** @type {ReturnType<typeof createStore>} */ let store;
  beforeEach(() => {
    store = createStore(); app = createApp(store);
  });

  it('should return 201 with a proof attached', async () => {
    const res = await request(app)
      .post('/credentials/issue')
      .send({credential: unsignedCredential()});
    assert.equal(res.status, 201);
    assert.ok(res.body.proof);
    assert.equal(res.body.proof.type, 'DataIntegrityProof');
  });

  it('should return 400 when credential is missing', async () => {
    const res = await request(app)
      .post('/credentials/issue')
      .send({});
    assert.equal(res.status, 400);
    assert.ok(res.body.type.includes('invalid-input'));
  });

  // vc-api-issuer-test-suite conformance checks
  /** @type {Array<{label: string, mutate: (c: Record<string, any>) => void}>} */
  const invalidInputCases = [
    {
      label: 'missing @context',
      mutate: c => {
        delete c['@context'];
      }
    },
    {
      label: '@context not an array',
      mutate: c => {
        c['@context'] = 4;
      }
    },
    {
      label: '@context item not a string',
      mutate: c => {
        c['@context'] = [{foo: true}];
      }
    },
    {
      label: 'missing type',
      mutate: c => {
        delete c.type;
      }
    },
    {
      label: 'type not an array',
      mutate: c => {
        c.type = 4;
      }
    },
    {
      label: 'type item not a string',
      mutate: c => {
        c.type = [null];
      }
    },
    {
      label: 'missing issuer',
      mutate: c => {
        delete c.issuer;
      }
    },
    {
      label: 'issuer invalid type',
      mutate: c => {
        c.issuer = 4;
      }
    },
    {
      label: 'missing credentialSubject',
      mutate: c => {
        delete c.credentialSubject;
      }
    },
    {
      label: 'credentialSubject not an object',
      mutate: c => {
        c.credentialSubject = 'did:example:1234';
      }
    }
  ];

  for(const {label, mutate} of invalidInputCases) {
    it(`should return 400 when credential has ${label}`, async () => {
      const credential = unsignedCredential();
      mutate(credential);
      const res = await request(app)
        .post('/credentials/issue')
        .send({credential});
      assert.equal(res.status, 400, `Expected 400 for: ${label}`);
      assert.ok(res.body.type.includes('invalid-input'));
    });
  }

  it('should return 201 when credential has expirationDate', async () => {
    const cred = unsignedCredential();
    const credential = /** @type {Record<string, any>} */ (cred);
    credential.expirationDate =
      new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        .replace(/\.\d+Z$/, 'Z');
    const res = await request(app)
      .post('/credentials/issue')
      .send({credential});
    assert.equal(res.status, 201);
  });

  it('should store the credential by credentialId option', async () => {
    const credentialId = 'test-cred-123';
    await request(app)
      .post('/credentials/issue')
      .send({credential: unsignedCredential(), options: {credentialId}});
    const stored = store.credentials.get(credentialId);
    assert.ok(stored);
    assert.equal(/** @type {any} */ (stored.vc).issuer, 'did:example:issuer');
  });
});

describe('GET /credentials/:id', () => {
  /** @type {import('express').Application} */ let app;
  /** @type {ReturnType<typeof createStore>} */ let store;
  beforeEach(() => {
    store = createStore(); app = createApp(store);
  });

  it('should retrieve an issued credential', async () => {
    const credentialId = 'get-test-cred';
    await request(app)
      .post('/credentials/issue')
      .send({credential: unsignedCredential(), options: {credentialId}});
    const res = await request(app).get(`/credentials/${credentialId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.issuer, 'did:example:issuer');
  });

  it('should return 404 for unknown credential', async () => {
    const res = await request(app).get('/credentials/does-not-exist');
    assert.equal(res.status, 404);
  });
});

describe('DELETE /credentials/:id', () => {
  /** @type {import('express').Application} */ let app;
  /** @type {ReturnType<typeof createStore>} */ let store;
  beforeEach(() => {
    store = createStore(); app = createApp(store);
  });

  it('should soft delete and return 202', async () => {
    const credentialId = 'delete-test-cred';
    await request(app)
      .post('/credentials/issue')
      .send({credential: unsignedCredential(), options: {credentialId}});
    const del = await request(app).delete(`/credentials/${credentialId}`);
    assert.equal(del.status, 202);
    const get = await request(app).get(`/credentials/${credentialId}`);
    assert.equal(get.status, 404);
  });
});

describe('POST /credentials/verify', () => {
  /** @type {import('express').Application} */ let app;
  /** @type {ReturnType<typeof createStore>} */ let store;
  beforeEach(() => {
    store = createStore(); app = createApp(store);
  });

  it('should return verified:true for a mock-issued credential', async () => {
    const issueRes = await request(app)
      .post('/credentials/issue')
      .send({credential: unsignedCredential()});
    const verifyRes = await request(app)
      .post('/credentials/verify')
      .send({verifiableCredential: issueRes.body});
    assert.equal(verifyRes.status, 200);
    assert.equal(verifyRes.body.verified, true);
  });

  it('should return verified:false for a credential with tampered proof',
    async () => {
      const vc = {
        ...unsignedCredential(),
        proof: {type: 'DataIntegrityProof', proofValue: 'bad'}
      };
      const res = await request(app)
        .post('/credentials/verify')
        .send({verifiableCredential: vc});
      assert.equal(res.status, 200);
      assert.equal(res.body.verified, false);
    });
});

describe('POST /credentials/derive', () => {
  /** @type {import('express').Application} */ let app;
  /** @type {ReturnType<typeof createStore>} */ let store;
  beforeEach(() => {
    store = createStore(); app = createApp(store);
  });

  it('should derive a credential with valid selectivePointers', async () => {
    const credentialId = 'derive-test-cred';
    const issueRes = await request(app)
      .post('/credentials/issue')
      .send({
        credential: bbsCredential(),
        options: {credentialId, mandatoryPointers: ['/credentialSubject/id']}
      });
    const deriveRes = await request(app)
      .post('/credentials/derive')
      .send({
        verifiableCredential: issueRes.body,
        options: {
          selectivePointers: [
            '/@context', '/type', '/issuer', '/validFrom',
            '/credentialSubject/id', '/credentialSubject/birthCountry'
          ]
        }
      });
    assert.equal(deriveRes.status, 201);
    assert.ok(deriveRes.body.proof);
  });

  it('should return 400 when selectivePointers missing a spec-level ' +
    'mandatory pointer', async () => {
    const credentialId = 'derive-fail-cred';
    const issueRes = await request(app)
      .post('/credentials/issue')
      .send({credential: bbsCredential(), options: {credentialId}});
    const deriveRes = await request(app)
      .post('/credentials/derive')
      .send({
        verifiableCredential: issueRes.body,
        options: {selectivePointers: ['/credentialSubject/name']}
      });
    assert.equal(deriveRes.status, 400);
    assert.ok(deriveRes.body.type.includes('missing-mandatory-pointers'));
    assert.ok(deriveRes.body.detail.includes('/issuer'));
  });

  it('should return 400 when selectivePointers missing issuer-specified ' +
    'mandatory pointer', async () => {
    const credentialId = 'derive-fail-mandatory';
    const issueRes = await request(app)
      .post('/credentials/issue')
      .send({
        credential: bbsCredential(),
        options: {credentialId, mandatoryPointers: ['/credentialSubject/id']}
      });
    const deriveRes = await request(app)
      .post('/credentials/derive')
      .send({
        verifiableCredential: issueRes.body,
        options: {
          selectivePointers: ['/@context', '/type', '/issuer', '/validFrom']
        }
      });
    assert.equal(deriveRes.status, 400);
    assert.ok(deriveRes.body.detail.includes('/credentialSubject/id'));
  });
});
