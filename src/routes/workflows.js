import {generateProof} from '../utils/proof.js';
import {problemDetails} from '../middleware/problemDetails.js';
import {randomUUID} from 'node:crypto';
import {Router} from 'express';

/** @typedef {import('../types.js').VerifiableCredential} VerifiableCredential */
/** @typedef {import('../types.js').WorkflowConfig} WorkflowConfig */

/**
 * @param {import('../store/index.js').createStore extends
 *   (...args: any[]) => infer R ? R : never} store
 * @returns {Router}
 */
export function workflowsRouter(store) {
  const router = Router();

  // POST /workflows
  router.post('/', (req, res) => {
    const body = /** @type {WorkflowConfig} */ (req.body ?? {});
    if(!body.steps || !body.initialStep) {
      return res.status(400).json(
        problemDetails(
          'invalid-input', 'Invalid Input', 400,
          'Workflow must include steps and initialStep.')
      );
    }
    const workflowId = body.id ?? randomUUID();
    store.workflows.set(workflowId, {...body, id: workflowId});
    const location =
      `${req.protocol}://${req.get('host')}/workflows/${workflowId}`;
    res.setHeader('Location', location);
    return res.status(201).send();
  });

  // GET /workflows/:workflowId
  router.get('/:workflowId', (req, res) => {
    const workflow = store.workflows.get(req.params.workflowId);
    if(!workflow) {
      return res.status(404).json(
        problemDetails(
          'not-found', 'Not Found', 404,
          `Workflow ${req.params.workflowId} not found.`)
      );
    }
    return res.status(200).json(workflow);
  });

  // POST /workflows/:workflowId/exchanges
  router.post('/:workflowId/exchanges', (req, res) => {
    const workflow = store.workflows.get(req.params.workflowId);
    if(!workflow) {
      return res.status(404).json(
        problemDetails(
          'not-found', 'Not Found', 404,
          `Workflow ${req.params.workflowId} not found.`)
      );
    }
    const {expires, variables = {}} = req.body ?? {};
    const exchangeId = randomUUID();
    const key = `${req.params.workflowId}:${exchangeId}`;
    store.exchanges.set(key, {
      id: exchangeId,
      workflowId: req.params.workflowId,
      sequence: 0,
      step: workflow.initialStep,
      state: 'pending',
      expires: expires ?? null,
      variables,
      lastError: null
    });
    const location =
      `${req.protocol}://${req.get('host')}` +
      `/workflows/${req.params.workflowId}/exchanges/${exchangeId}`;
    res.setHeader('Location', location);
    return res.status(201).send();
  });

  // GET /workflows/:workflowId/exchanges/:exchangeId
  router.get('/:workflowId/exchanges/:exchangeId', (req, res) => {
    const {workflowId, exchangeId} = req.params;
    const exchange = store.exchanges.get(`${workflowId}:${exchangeId}`);
    if(!exchange) {
      return res.status(404).json(
        problemDetails(
          'not-found', 'Not Found', 404,
          `Exchange ${exchangeId} not found.`)
      );
    }
    return res.status(200).json(exchange);
  });

  // POST /workflows/:workflowId/exchanges/:exchangeId — participate
  router.post('/:workflowId/exchanges/:exchangeId', (req, res) => {
    const {workflowId, exchangeId} = req.params;
    const key = `${workflowId}:${exchangeId}`;
    const exchange = store.exchanges.get(key);

    if(!exchange) {
      return res.status(404).json(
        problemDetails(
          'not-found', 'Not Found', 404,
          `Exchange ${exchangeId} not found.`)
      );
    }

    // Check expiry
    if(exchange.expires && new Date(exchange.expires) < new Date()) {
      exchange.state = 'invalid';
      return res.status(400).json(
        problemDetails(
          'exchange-expired', 'Exchange Expired', 400,
          `Exchange ${exchangeId} has expired.`)
      );
    }

    // Reject redirectUrl
    if(req.body?.redirectUrl) {
      return res.status(400).json(
        problemDetails(
          'redirect-url-not-supported', 'Redirect URL Not Supported', 400,
          'redirectUrl is not supported by this implementation.')
      );
    }

    const workflow = store.workflows.get(workflowId);
    const stepConfig = workflow?.steps?.[exchange.step] ?? {};

    exchange.sequence += 1;
    exchange.state = 'active';

    // Client sends a VP — advance step
    if(req.body?.verifiablePresentation) {
      const nextStep = stepConfig.nextStep;

      // Handle issueRequests in this step
      if((stepConfig.issueRequests?.length ?? 0) > 0) {
        const template = workflow?.credentialTemplates?.[0];
        if(template) {
          const issuedVc = /** @type {VerifiableCredential} */ ({
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            issuer: 'did:example:mock',
            validFrom: new Date().toISOString(),
            credentialSubject: {id: 'did:example:holder'}
          });
          issuedVc.proof = generateProof(issuedVc);
          if(nextStep) {
            exchange.step = nextStep;
            return res.status(200).json({verifiablePresentation: {
              '@context': ['https://www.w3.org/ns/credentials/v2'],
              type: ['VerifiablePresentation'],
              verifiableCredential: [issuedVc]
            }});
          }
          exchange.state = 'complete';
          return res.status(200).json({verifiablePresentation: {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiablePresentation'],
            verifiableCredential: [issuedVc]
          }});
        }
      }

      if(nextStep) {
        exchange.step = nextStep;
        const nextStepConfig = workflow?.steps?.[nextStep] ?? {};
        if(nextStepConfig.verifiablePresentationRequest) {
          return res.status(200).json({
            verifiablePresentationRequest:
              nextStepConfig.verifiablePresentationRequest
          });
        }
      }

      exchange.state = 'complete';
      return res.status(200).json({});
    }

    // Empty body or VPR — return current step's VPR
    if(stepConfig.verifiablePresentationRequest) {
      return res.status(200).json({
        verifiablePresentationRequest:
          stepConfig.verifiablePresentationRequest
      });
    }

    exchange.state = 'complete';
    return res.status(200).json({});
  });

  // GET /workflows/:workflowId/exchanges/:exchangeId/protocols
  router.get(
    '/:workflowId/exchanges/:exchangeId/protocols',
    (req, res) => {
      const {workflowId, exchangeId} = req.params;
      const exchange =
        store.exchanges.get(`${workflowId}:${exchangeId}`);
      if(!exchange) {
        return res.status(404).json(
          problemDetails(
            'not-found', 'Not Found', 404,
            `Exchange ${exchangeId} not found.`)
        );
      }
      const base = `${req.protocol}://${req.get('host')}`;
      return res.status(200).json({
        protocols: {
          vcapi:
            `${base}/workflows/${workflowId}/exchanges/${exchangeId}`
        }
      });
    });

  return router;
}
