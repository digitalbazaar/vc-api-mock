import {strict as assert} from 'node:assert';
import {createApp} from '../../src/server.js';
import {createStore} from '../../src/store/index.js';
import {unsignedCredential} from '../fixtures/credential.js';

import request from 'supertest';

/** @param {object} vc */
function buildPresentation(vc) {
  return {
    '@context': ['https://www.w3.org/ns/credentials/v2'],
    type: ['VerifiablePresentation'],
    holder: 'did:example:alice',
    verifiableCredential: [vc]
  };
}

describe('POST /presentations (create)', () => {
  /** @type {import('express').Application} */ let app;
  /** @type {ReturnType<typeof createStore>} */ let store;
  beforeEach(() => {
    store = createStore(); app = createApp(store);
  });

  it('should return 201 with a signed presentation', async () => {
    const issueRes = await request(app)
      .post('/credentials/issue')
      .send({credential: unsignedCredential()});
    const pres = buildPresentation(issueRes.body);
    const res = await request(app)
      .post('/presentations')
      .send({presentation: pres});
    assert.equal(res.status, 201);
    assert.ok(res.body.verifiablePresentation.proof);
  });

  it('should bind challenge and domain into the proof', async () => {
    const issueRes = await request(app)
      .post('/credentials/issue')
      .send({credential: unsignedCredential()});
    const pres = buildPresentation(issueRes.body);
    const res = await request(app)
      .post('/presentations')
      .send({
        presentation: pres,
        options: {challenge: 'abc123', domain: 'example.com'}
      });
    assert.equal(
      res.body.verifiablePresentation.proof.challenge, 'abc123'
    );
    assert.equal(
      res.body.verifiablePresentation.proof.domain, 'example.com'
    );
  });
});

describe('POST /presentations/verify', () => {
  /** @type {import('express').Application} */ let app;
  /** @type {ReturnType<typeof createStore>} */ let store;
  beforeEach(() => {
    store = createStore(); app = createApp(store);
  });

  it('should return verified:true for a valid signed presentation',
    async () => {
      const issueRes = await request(app)
        .post('/credentials/issue')
        .send({credential: unsignedCredential()});
      const createRes = await request(app)
        .post('/presentations')
        .send({presentation: buildPresentation(issueRes.body)});
      const verifyRes = await request(app)
        .post('/presentations/verify')
        .send({verifiablePresentation: createRes.body.verifiablePresentation});
      assert.equal(verifyRes.status, 200);
      assert.equal(verifyRes.body.verified, true);
    });

  it('should return 200 verified:false for tampered proof', async () => {
    const issueRes = await request(app)
      .post('/credentials/issue')
      .send({credential: unsignedCredential()});
    const vp = {
      ...buildPresentation(issueRes.body),
      proof: {type: 'DataIntegrityProof', proofValue: 'tampered'}
    };
    const res = await request(app)
      .post('/presentations/verify')
      .send({verifiablePresentation: vp});
    assert.equal(res.status, 200);
    assert.equal(res.body.verified, false);
  });

  it('should return 400 on challenge mismatch', async () => {
    const issueRes = await request(app)
      .post('/credentials/issue')
      .send({credential: unsignedCredential()});
    const createRes = await request(app)
      .post('/presentations')
      .send({
        presentation: buildPresentation(issueRes.body),
        options: {challenge: 'correct-challenge'}
      });
    // Store 'wrong-challenge' so single-use guard passes, then mismatch fires
    const TTL_MS = 5 * 60 * 1000;
    store.challenges.set('wrong-challenge', {expires: Date.now() + TTL_MS});
    const res = await request(app)
      .post('/presentations/verify')
      .send({
        verifiablePresentation: createRes.body.verifiablePresentation,
        options: {challenge: 'wrong-challenge'}
      });
    assert.equal(res.status, 400);
    assert.ok(res.body.type.includes('challenge-mismatch'));
  });

  it('should accept proofless presentation and verify enclosed credentials',
    async () => {
      const issueRes = await request(app)
        .post('/credentials/issue')
        .send({credential: unsignedCredential()});
      const presentation = buildPresentation(issueRes.body);
      const res = await request(app)
        .post('/presentations/verify')
        .send({presentation});
      assert.equal(res.status, 200);
      assert.equal(res.body.verified, true);
    });

  it('should proceed with warning when holder present but no proof',
    async () => {
      const issueRes = await request(app)
        .post('/credentials/issue')
        .send({credential: unsignedCredential()});
      // VP with holder but no proof
      const vp = buildPresentation(issueRes.body);
      const res = await request(app)
        .post('/presentations/verify')
        .send({verifiablePresentation: vp});
      assert.equal(res.status, 200);
      // verified based on enclosed credentials only
      assert.equal(res.body.verified, true);
    });
});

describe('GET /presentations', () => {
  /** @type {import('express').Application} */ let app;
  /** @type {ReturnType<typeof createStore>} */ let store;
  beforeEach(() => {
    store = createStore(); app = createApp(store);
  });

  it('should list stored presentations', async () => {
    const issueRes = await request(app)
      .post('/credentials/issue')
      .send({credential: unsignedCredential()});
    await request(app)
      .post('/presentations')
      .send({presentation: buildPresentation(issueRes.body)});
    const res = await request(app).get('/presentations');
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
  });
});
