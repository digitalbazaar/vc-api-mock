import {strict as assert} from 'node:assert';
import {createApp} from '../../src/server.js';
import {createStore} from '../../src/store/index.js';
import request from 'supertest';

describe('status endpoints', () => {
  /** @type {import('express').Application} */ let app;
  /** @type {ReturnType<typeof createStore>} */ let store;

  beforeEach(() => {
    store = createStore();
    app = createApp(store);
  });

  describe('POST /status-lists', () => {
    it('should create a status list and return 201', async () => {
      const res = await request(app)
        .post('/status-lists')
        .send({statusPurpose: 'revocation'});
      assert.equal(res.status, 201);
      assert.ok(res.body.id);
      assert.ok(res.body.verifiableCredential);
      assert.ok(res.get('Location'));
    });

    it('should return a status list VC with correct shape', async () => {
      const res = await request(app)
        .post('/status-lists')
        .send({statusPurpose: 'suspension'});
      const {verifiableCredential: vc} = res.body;
      assert.ok(
        vc.type.includes('StatusList2021Credential'),
        'type should include StatusList2021Credential'
      );
      assert.equal(vc.credentialSubject.statusPurpose, 'suspension');
      assert.ok(vc.proof, 'should have proof');
    });

    it('should use provided id', async () => {
      const id = 'https://vcalm.example/status-lists/test-123';
      const res = await request(app)
        .post('/status-lists')
        .send({statusPurpose: 'revocation', id});
      assert.equal(res.status, 201);
      assert.equal(res.body.id, id);
    });

    it('should return 400 when statusPurpose is missing', async () => {
      const res = await request(app)
        .post('/status-lists')
        .send({});
      assert.equal(res.status, 400);
      assert.ok(res.body.type.includes('invalid-input'));
    });
  });

  describe('POST /credentials/status', () => {
    it('should update a credential status and return 200', async () => {
      const issueRes = await request(app)
        .post('/credentials/issue')
        .send({
          credential: {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            issuer: 'did:example:mock',
            validFrom: new Date().toISOString(),
            credentialSubject: {id: 'did:example:alice'}
          },
          options: {credentialId: 'cred-status-test'}
        });
      assert.equal(issueRes.status, 201);

      const statusRes = await request(app)
        .post('/credentials/status')
        .send({
          credentialId: 'cred-status-test',
          credentialStatus: {
            type: 'StatusList2021Entry',
            statusPurpose: 'revocation',
            statusListIndex: '42',
            statusListCredential: 'https://vcalm.example/status-lists/1'
          }
        });
      assert.equal(statusRes.status, 200);
    });

    it('should reflect updated status on GET', async () => {
      await request(app)
        .post('/credentials/issue')
        .send({
          credential: {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            issuer: 'did:example:mock',
            validFrom: new Date().toISOString(),
            credentialSubject: {id: 'did:example:alice'}
          },
          options: {credentialId: 'cred-get-status-test'}
        });

      const credentialStatus = {
        type: 'StatusList2021Entry',
        statusPurpose: 'revocation',
        statusListIndex: '7',
        statusListCredential: 'https://vcalm.example/status-lists/1'
      };
      await request(app)
        .post('/credentials/status')
        .send({credentialId: 'cred-get-status-test', credentialStatus});

      const getRes = await request(app)
        .get('/credentials/cred-get-status-test');
      assert.equal(getRes.status, 200);
      assert.deepEqual(getRes.body.credentialStatus, credentialStatus);
    });

    it('should return 404 for unknown credential', async () => {
      const res = await request(app)
        .post('/credentials/status')
        .send({
          credentialId: 'does-not-exist',
          credentialStatus: {type: 'StatusList2021Entry'}
        });
      assert.equal(res.status, 404);
      assert.ok(res.body.type.includes('not-found'));
    });

    it('should return 400 when credentialId is missing', async () => {
      const res = await request(app)
        .post('/credentials/status')
        .send({credentialStatus: {type: 'StatusList2021Entry'}});
      assert.equal(res.status, 400);
      assert.ok(res.body.type.includes('invalid-input'));
    });
  });

  describe('GET /status-lists/:id', () => {
    it('should retrieve a stored status list', async () => {
      const createRes = await request(app)
        .post('/status-lists')
        .send({statusPurpose: 'revocation'});
      const {id} = createRes.body;

      const encodedId = encodeURIComponent(id);
      const getRes = await request(app)
        .get(`/status-lists/${encodedId}`);
      assert.equal(getRes.status, 200);
      assert.equal(getRes.body.id, id);
    });

    it('should return 404 for unknown status list', async () => {
      const res = await request(app)
        .get('/status-lists/unknown-id');
      assert.equal(res.status, 404);
      assert.ok(res.body.type.includes('not-found'));
    });
  });
});
