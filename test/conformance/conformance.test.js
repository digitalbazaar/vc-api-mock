/**
 * Conformance smoke tests for VCALM HTTP API.
 *
 * Runs against the local mock by default. Point at a real server:
 *   VCALM_BASE_URL=https://real-server.example npm run test:conformance
 *
 * Covers the happy path for each role: issuer, verifier, holder.
 * Every test is self-contained — no shared state between tests.
 */

import {getAgent, SAMPLE_CREDENTIAL, SAMPLE_PRESENTATION}
  from './helpers.js';
import {strict as assert} from 'node:assert';
import {validateResponse} from './validator.js';

// ---------------------------------------------------------------------------
// Issuer role
// ---------------------------------------------------------------------------

describe('[conformance] issuer — issue a credential', () => {
  it('POST /credentials/issue returns 201 with a proof', async () => {
    const {agent} = getAgent();
    const res = await agent
      .post('/credentials/issue')
      .set('Content-Type', 'application/json')
      .send({credential: SAMPLE_CREDENTIAL});
    assert.equal(res.status, 201, res.text);
    assert.ok(res.body.proof, 'issued VC must have a proof');
    assert.ok(res.body.issuer, 'issued VC must have an issuer');
    await validateResponse('VerifiableCredential', res.body);
  });

  it('GET /credentials/:id returns the issued VC', async () => {
    const {agent} = getAgent();
    const credentialId = `conformance-get-${Date.now()}`;
    await agent
      .post('/credentials/issue')
      .set('Content-Type', 'application/json')
      .send({
        credential: SAMPLE_CREDENTIAL,
        options: {credentialId}
      });
    const res = await agent.get(`/credentials/${credentialId}`);
    assert.equal(res.status, 200, res.text);
    assert.ok(res.body.proof, 'retrieved VC must have a proof');
    await validateResponse('VerifiableCredential', res.body);
  });

  it('DELETE /credentials/:id soft-deletes, then GET returns 404', async () => {
    const {agent} = getAgent();
    const credentialId = `conformance-delete-${Date.now()}`;
    await agent
      .post('/credentials/issue')
      .set('Content-Type', 'application/json')
      .send({
        credential: SAMPLE_CREDENTIAL,
        options: {credentialId}
      });
    const delRes = await agent.delete(`/credentials/${credentialId}`);
    assert.equal(delRes.status, 202, delRes.text);

    const getRes = await agent.get(`/credentials/${credentialId}`);
    assert.equal(getRes.status, 404, 'deleted credential should 404');
  });
});

// ---------------------------------------------------------------------------
// Verifier role
// ---------------------------------------------------------------------------

describe('[conformance] verifier — verify a credential', () => {
  it('POST /credentials/verify returns verified:true for valid VC',
    async () => {
      const {agent} = getAgent();
      const issueRes = await agent
        .post('/credentials/issue')
        .set('Content-Type', 'application/json')
        .send({credential: SAMPLE_CREDENTIAL});
      const vc = issueRes.body;

      const res = await agent
        .post('/credentials/verify')
        .set('Content-Type', 'application/json')
        .send({verifiableCredential: vc});
      assert.equal(res.status, 200, res.text);
      assert.equal(res.body.verified, true, 'valid VC should verify');
      await validateResponse('VerificationResult', res.body);
    });

  it('POST /credentials/verify returns verified:false for tampered VC',
    async () => {
      const {agent} = getAgent();
      const issueRes = await agent
        .post('/credentials/issue')
        .set('Content-Type', 'application/json')
        .send({credential: SAMPLE_CREDENTIAL});
      const vc = {
        ...issueRes.body,
        proof: {...issueRes.body.proof, proofValue: 'tampered'}
      };
      const res = await agent
        .post('/credentials/verify')
        .set('Content-Type', 'application/json')
        .send({verifiableCredential: vc});
      assert.equal(res.status, 200, res.text);
      assert.equal(res.body.verified, false, 'tampered VC should not verify');
      await validateResponse('VerificationResult', res.body);
    });
});

// ---------------------------------------------------------------------------
// Holder role — presentations
// ---------------------------------------------------------------------------

describe('[conformance] holder — create and verify a presentation', () => {
  it('POST /presentations returns 201 with a proof', async () => {
    const {agent} = getAgent();
    const issueRes = await agent
      .post('/credentials/issue')
      .set('Content-Type', 'application/json')
      .send({credential: SAMPLE_CREDENTIAL});

    const res = await agent
      .post('/presentations')
      .set('Content-Type', 'application/json')
      .send({
        presentation: {
          ...SAMPLE_PRESENTATION,
          verifiableCredential: [issueRes.body]
        }
      });
    assert.equal(res.status, 201, res.text);
    assert.ok(res.body.verifiablePresentation.proof, 'VP must have a proof');
    await validateResponse(
      'VerifiablePresentation', res.body.verifiablePresentation
    );
  });

  it('POST /presentations/verify returns verified:true for valid VP',
    async () => {
      const {agent} = getAgent();
      const issueRes = await agent
        .post('/credentials/issue')
        .set('Content-Type', 'application/json')
        .send({credential: SAMPLE_CREDENTIAL});
      const presentRes = await agent
        .post('/presentations')
        .set('Content-Type', 'application/json')
        .send({
          presentation: {
            ...SAMPLE_PRESENTATION,
            verifiableCredential: [issueRes.body]
          }
        });

      const res = await agent
        .post('/presentations/verify')
        .set('Content-Type', 'application/json')
        .send({
          verifiablePresentation: presentRes.body.verifiablePresentation
        });
      assert.equal(res.status, 200, res.text);
      assert.equal(res.body.verified, true, 'valid VP should verify');
      await validateResponse('VerificationResult', res.body);
    });
});

// ---------------------------------------------------------------------------
// Selective disclosure (derive)
// ---------------------------------------------------------------------------

describe('[conformance] selective disclosure — derive', () => {
  it('POST /credentials/derive returns a derived VC with fewer fields',
    async () => {
      const {agent} = getAgent();
      const credentialId = `conformance-derive-${Date.now()}`;
      const mandatoryPointers = ['/credentialSubject/name'];
      const issueRes = await agent
        .post('/credentials/issue')
        .set('Content-Type', 'application/json')
        .send({
          credential: SAMPLE_CREDENTIAL,
          options: {credentialId, mandatoryPointers}
        });
      const vc = issueRes.body;

      const selectivePointers = [
        '/@context', '/type', '/issuer', '/validFrom',
        '/credentialSubject/name'
      ];
      const res = await agent
        .post('/credentials/derive')
        .set('Content-Type', 'application/json')
        .send({
          verifiableCredential: vc,
          options: {credentialId, selectivePointers}
        });
      assert.equal(res.status, 201, res.text);
      assert.ok(res.body.proof, 'derived VC must have a proof');
      await validateResponse('VerifiableCredential', res.body);
    });

  it('POST /credentials/derive returns 400 when mandatory pointer is missing',
    async () => {
      const {agent} = getAgent();
      const credentialId = `conformance-derive-miss-${Date.now()}`;
      const mandatoryPointers = ['/credentialSubject/name'];
      const issueRes = await agent
        .post('/credentials/issue')
        .set('Content-Type', 'application/json')
        .send({
          credential: SAMPLE_CREDENTIAL,
          options: {credentialId, mandatoryPointers}
        });

      const res = await agent
        .post('/credentials/derive')
        .set('Content-Type', 'application/json')
        .send({
          verifiableCredential: issueRes.body,
          options: {
            credentialId,
            selectivePointers: ['/@context', '/type', '/issuer', '/validFrom']
          }
        });
      assert.equal(res.status, 400, res.text);
      assert.ok(
        res.body.type?.includes('missing-mandatory-pointers'),
        'error type should indicate missing mandatory pointers'
      );
    });
});

// ---------------------------------------------------------------------------
// Challenges
// ---------------------------------------------------------------------------

describe('[conformance] challenges', () => {
  it('POST /challenges returns a nonce string', async () => {
    const {agent} = getAgent();
    const res = await agent
      .post('/challenges')
      .set('Content-Type', 'application/json')
      .send({});
    assert.equal(res.status, 201, res.text);
    assert.ok(
      typeof res.body.challenge === 'string' && res.body.challenge.length > 0,
      'challenge must be a non-empty string'
    );
  });
});

// ---------------------------------------------------------------------------
// Status lists
// ---------------------------------------------------------------------------

describe('[conformance] status lists', () => {
  it('POST /status-lists returns 201 with a status list VC', async () => {
    const {agent} = getAgent();
    const res = await agent
      .post('/status-lists')
      .set('Content-Type', 'application/json')
      .send({statusPurpose: 'revocation'});
    assert.equal(res.status, 201, res.text);
    assert.ok(res.body.id, 'response must include id');
    assert.ok(
      res.body.verifiableCredential?.proof,
      'status list must have a proof'
    );
    assert.ok(res.get('Location'), 'response must include Location header');
  });

  it('GET /status-lists/:id returns the status list VC (public)', async () => {
    const {agent} = getAgent();
    const createRes = await agent
      .post('/status-lists')
      .set('Content-Type', 'application/json')
      .send({statusPurpose: 'revocation'});
    const {id} = createRes.body;

    const res = await agent.get(`/status-lists/${encodeURIComponent(id)}`);
    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.id, id);
  });
});

// ---------------------------------------------------------------------------
// Workflows + exchanges
// ---------------------------------------------------------------------------

describe('[conformance] workflows and exchanges', () => {
  const WORKFLOW = {
    initialStep: 'step1',
    steps: {
      step1: {
        verifiablePresentationRequest: {
          query: [{type: 'QueryByExample'}]
        }
      }
    }
  };

  it('POST /workflows returns 201 with Location header', async () => {
    const {agent} = getAgent();
    const res = await agent
      .post('/workflows')
      .set('Content-Type', 'application/json')
      .send(WORKFLOW);
    assert.equal(res.status, 201, res.text);
    assert.ok(res.get('Location'), 'must return Location header');
  });

  it('GET /workflows/:id returns the workflow config', async () => {
    const {agent} = getAgent();
    const createRes = await agent
      .post('/workflows')
      .set('Content-Type', 'application/json')
      .send(WORKFLOW);
    const workflowId = createRes.get('Location').split('/').pop();

    const res = await agent.get(`/workflows/${workflowId}`);
    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.initialStep, 'step1');
  });

  it('full exchange: create → empty POST → get VPR', async () => {
    const {agent} = getAgent();
    const workflowRes = await agent
      .post('/workflows')
      .set('Content-Type', 'application/json')
      .send(WORKFLOW);
    const workflowId = workflowRes.get('Location').split('/').pop();

    const exchangeRes = await agent
      .post(`/workflows/${workflowId}/exchanges`)
      .set('Content-Type', 'application/json')
      .send({});
    assert.equal(exchangeRes.status, 201, exchangeRes.text);
    const exchangeId = exchangeRes.get('Location').split('/').pop();

    const participateRes = await agent
      .post(`/workflows/${workflowId}/exchanges/${exchangeId}`)
      .set('Content-Type', 'application/json')
      .send({});
    assert.equal(participateRes.status, 200, participateRes.text);
    assert.ok(
      participateRes.body.verifiablePresentationRequest,
      'should return VPR for step1'
    );
  });
});
