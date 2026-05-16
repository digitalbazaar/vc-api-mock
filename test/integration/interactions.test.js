import {strict as assert} from 'node:assert';
import {createApp} from '../../src/server.js';
import {createStore} from '../../src/store/index.js';
import request from 'supertest';

describe('challenges', () => {
  /** @type {import('express').Application} */ let app;
  /** @type {ReturnType<typeof createStore>} */ let store;

  beforeEach(() => {
    store = createStore();
    app = createApp(store);
  });

  describe('POST /challenges', () => {
    it('should return a nonce', async () => {
      const res = await request(app)
        .post('/challenges')
        .send({});
      assert.equal(res.status, 201);
      assert.ok(typeof res.body.challenge === 'string');
      assert.ok(res.body.challenge.length > 0);
    });

    it('should return a unique nonce each call', async () => {
      const r1 = await request(app).post('/challenges').send({});
      const r2 = await request(app).post('/challenges').send({});
      assert.notEqual(r1.body.challenge, r2.body.challenge);
    });
  });

  describe('challenge single-use enforcement via /presentations/verify', () => {
    it('should reject a reused challenge', async () => {
      const challengeRes = await request(app).post('/challenges').send({});
      const {challenge} = challengeRes.body;

      const vp = {
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        type: ['VerifiablePresentation'],
        proof: {
          type: 'DataIntegrityProof',
          challenge,
          proofValue: 'mock-proof-abc'
        }
      };

      await request(app)
        .post('/presentations/verify')
        .send({verifiablePresentation: vp, options: {challenge}});

      const second = await request(app)
        .post('/presentations/verify')
        .send({verifiablePresentation: vp, options: {challenge}});

      assert.equal(second.status, 400);
      assert.ok(second.body.type.includes('challenge'));
    });
  });
});

describe('interactions', () => {
  /** @type {import('express').Application} */ let app;
  /** @type {ReturnType<typeof createStore>} */ let store;

  beforeEach(() => {
    store = createStore();
    app = createApp(store);
  });

  describe('GET /interactions/:id', () => {
    it('should return protocols when iuv=1', async () => {
      const res = await request(app)
        .get('/interactions/test-interaction-abc?iuv=1');
      assert.equal(res.status, 200);
      assert.ok(res.body.protocols);
    });

    it('should return 400 when iuv param is missing', async () => {
      const res = await request(app)
        .get('/interactions/some-id');
      assert.equal(res.status, 400);
      assert.ok(res.body.type.includes('invalid-input'));
    });
  });
});
