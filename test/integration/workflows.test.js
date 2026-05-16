import {strict as assert} from 'node:assert';
import {createApp} from '../../src/server.js';
import {createStore} from '../../src/store/index.js';
import {unsignedCredential} from '../fixtures/credential.js';

import request from 'supertest';

const sampleWorkflow = {
  initialStep: 'requestCredential',
  steps: {
    requestCredential: {
      verifiablePresentationRequest: {
        query: [{
          type: 'QueryByExample',
          credentialQuery: [{reason: 'Please provide your credential'}]
        }]
      }
    }
  }
};

describe('POST /workflows', () => {
  /** @type {import('express').Application} */ let app;
  /** @type {ReturnType<typeof createStore>} */ let store;
  beforeEach(() => {
    store = createStore(); app = createApp(store);
  });

  it('should return 201 with Location header', async () => {
    const res = await request(app)
      .post('/workflows')
      .send(sampleWorkflow);
    assert.equal(res.status, 201);
    assert.ok(res.headers.location);
  });

  it('should return 400 when steps or initialStep missing', async () => {
    const res = await request(app)
      .post('/workflows')
      .send({initialStep: 'foo'});
    assert.equal(res.status, 400);
  });
});

describe('GET /workflows/:id', () => {
  /** @type {import('express').Application} */ let app;
  /** @type {ReturnType<typeof createStore>} */ let store;
  beforeEach(() => {
    store = createStore(); app = createApp(store);
  });

  it('should retrieve a created workflow', async () => {
    const createRes = await request(app)
      .post('/workflows')
      .send(sampleWorkflow);
    const workflowId = createRes.headers.location.split('/').pop();
    const res = await request(app).get(`/workflows/${workflowId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.initialStep, 'requestCredential');
  });
});

describe('Exchange lifecycle', () => {
  /** @type {import('express').Application} */ let app;
  /** @type {ReturnType<typeof createStore>} */ let store;
  /** @type {string} */ let workflowId;
  beforeEach(async () => {
    store = createStore();
    app = createApp(store);
    const res = await request(app).post('/workflows').send(sampleWorkflow);
    workflowId = res.headers.location.split('/').pop() ?? '';
  });

  it('should create an exchange and return Location header', async () => {
    const res = await request(app)
      .post(`/workflows/${workflowId}/exchanges`)
      .send({});
    assert.equal(res.status, 201);
    assert.ok(res.headers.location);
  });

  it('should return VPR when posting empty body to exchange', async () => {
    const createRes = await request(app)
      .post(`/workflows/${workflowId}/exchanges`)
      .send({});
    const exchangeId = createRes.headers.location.split('/').pop();
    const res = await request(app)
      .post(`/workflows/${workflowId}/exchanges/${exchangeId}`)
      .send({});
    assert.equal(res.status, 200);
    assert.ok(res.body.verifiablePresentationRequest);
  });

  it('should complete exchange when VP is submitted', async () => {
    const createRes = await request(app)
      .post(`/workflows/${workflowId}/exchanges`)
      .send({});
    const exchangeId = createRes.headers.location.split('/').pop();

    // First step: get VPR
    await request(app)
      .post(`/workflows/${workflowId}/exchanges/${exchangeId}`)
      .send({});

    // Issue a credential to present
    const issueRes = await request(app)
      .post('/credentials/issue')
      .send({credential: unsignedCredential()});

    // Submit VP
    const vp = {
      '@context': ['https://www.w3.org/ns/credentials/v2'],
      type: ['VerifiablePresentation'],
      verifiableCredential: [issueRes.body]
    };
    const res = await request(app)
      .post(`/workflows/${workflowId}/exchanges/${exchangeId}`)
      .send({verifiablePresentation: vp});
    assert.equal(res.status, 200);

    // Exchange should be complete
    const stateRes = await request(app)
      .get(`/workflows/${workflowId}/exchanges/${exchangeId}`);
    assert.equal(stateRes.body.state, 'complete');
  });

  it('should return 400 for redirectUrl client message', async () => {
    const createRes = await request(app)
      .post(`/workflows/${workflowId}/exchanges`)
      .send({});
    const exchangeId = createRes.headers.location.split('/').pop();
    const res = await request(app)
      .post(`/workflows/${workflowId}/exchanges/${exchangeId}`)
      .send({redirectUrl: 'https://other.example/exchange/123'});
    assert.equal(res.status, 400);
    assert.ok(res.body.type.includes('redirect-url-not-supported'));
  });

  it('should return 400 for expired exchange', async () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const createRes = await request(app)
      .post(`/workflows/${workflowId}/exchanges`)
      .send({expires: past});
    const exchangeId = createRes.headers.location.split('/').pop();
    const res = await request(app)
      .post(`/workflows/${workflowId}/exchanges/${exchangeId}`)
      .send({});
    assert.equal(res.status, 400);
    assert.ok(res.body.type.includes('exchange-expired'));
  });
});
