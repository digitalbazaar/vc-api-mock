import {problemDetails} from '../middleware/problemDetails.js';
import {Router} from 'express';

/**
 * @param {import('../store/index.js').createStore extends
 *   (...args: any[]) => infer R ? R : never} store
 * @returns {Router}
 */
export function interactionsRouter(store) {
  const router = Router();

  // POST /challenges
  router.post('/challenges', (_req, res) => {
    const nonce = crypto.randomUUID();
    const TTL_MS = 5 * 60 * 1000; // 5 minutes
    store.challenges.set(nonce, {expires: Date.now() + TTL_MS});
    return res.status(201).json({challenge: nonce});
  });

  // GET /interactions/:interactionId
  router.get('/interactions/:interactionId', (req, res) => {
    const {iuv} = req.query;
    if(iuv !== '1') {
      return res.status(400).json(
        problemDetails(
          'invalid-input', 'Invalid Input', 400,
          'Query parameter iuv=1 is required.')
      );
    }
    const base = `${req.protocol}://${req.get('host')}`;
    return res.status(200).json({
      protocols: {
        vcapi:
          `${base}/workflows/default/exchanges/` +
          `${req.params.interactionId}`
      }
    });
  });

  // POST /:inviteId/invite-request/response
  router.post('/:inviteId/invite-request/response', (req, res) => {
    const {url, purpose, referenceId} = req.body ?? {};
    if(!url || !purpose || !referenceId) {
      return res.status(400).json(
        problemDetails(
          'invalid-input', 'Invalid Input', 400,
          'Request body must include url, purpose, and referenceId.')
      );
    }
    return res.status(200).send();
  });

  return router;
}
