import {generateProof, verifyProof} from '../utils/proof.js';
import {problemDetails} from '../middleware/problemDetails.js';
import {randomUUID} from 'node:crypto';
import {Router} from 'express';

/**
 * @param {import('../store/index.js').createStore extends
 *   (...args: any[]) => infer R ? R : never} store
 * @returns {Router}
 */
export function presentationsRouter(store) {
  const router = Router();

  // POST /presentations/verify
  router.post('/verify', (req, res) => {
    const {verifiablePresentation, presentation, options = {}} =
      req.body ?? {};

    // Proofless verify — just check enclosed credentials
    if(presentation && !verifiablePresentation) {
      const credentials = presentation.verifiableCredential ?? [];
      const results = credentials.map(
        (/** @type {import('../types.js').VerifiableCredential} */ vc) =>
          ({verified: verifyProof(vc)})
      );
      const verified = results.every(
        (/** @type {{verified: boolean}} */ r) => r.verified
      );
      return res.status(200).json({verified, results});
    }

    if(!verifiablePresentation) {
      return res.status(400).json(
        problemDetails(
          'invalid-input', 'Invalid Input', 400,
          'Request body must include a verifiablePresentation or ' +
          'presentation property.')
      );
    }

    // Warn if holder is present but no proof
    if(verifiablePresentation.holder && !verifiablePresentation.proof) {
      console.warn(
        'holder field present but ignored — no presentation proof'
      );
    }

    // Check challenge/domain binding
    const {challenge, domain} = options;

    // Enforce single-use challenge
    if(challenge) {
      const stored = store.challenges.get(challenge);
      if(!stored) {
        return res.status(400).json(
          problemDetails(
            'challenge-invalid', 'Invalid Challenge', 400,
            'The challenge is unknown or has already been used.')
        );
      }
      if(stored.expires < Date.now()) {
        store.challenges.delete(challenge);
        return res.status(400).json(
          problemDetails(
            'challenge-expired', 'Challenge Expired', 400,
            'The challenge has expired.')
        );
      }
      store.challenges.delete(challenge);
    }

    if(verifiablePresentation.proof) {
      if(challenge && verifiablePresentation.proof.challenge !== challenge) {
        return res.status(400).json(
          problemDetails(
            'challenge-mismatch', 'Challenge Mismatch', 400,
            'The challenge in the presentation proof does not match ' +
            'the expected challenge.')
        );
      }
      if(domain && verifiablePresentation.proof.domain !== domain) {
        return res.status(400).json(
          problemDetails(
            'challenge-mismatch', 'Domain Mismatch', 400,
            'The domain in the presentation proof does not match ' +
            'the expected domain.')
        );
      }
    }

    const presentationVerified = verifiablePresentation.proof ?
      verifyProof(verifiablePresentation) :
      true;

    const credentials = verifiablePresentation.verifiableCredential ?? [];
    const credResults = credentials.map(
      (/** @type {import('../types.js').VerifiableCredential} */ vc) =>
        ({verified: verifyProof(vc)})
    );
    const verified = presentationVerified &&
      credResults.every(
        (/** @type {{verified: boolean}} */ r) => r.verified
      );

    return res.status(200).json({verified, results: credResults});
  });

  // POST /presentations (createPresentation)
  router.post('/', (req, res) => {
    const {presentation, options = {}} = req.body ?? {};
    if(!presentation) {
      return res.status(400).json(
        problemDetails(
          'invalid-input', 'Invalid Input', 400,
          'Request body must include a presentation property.')
      );
    }

    const proof = {
      ...generateProof(presentation),
      ...(options.challenge ? {challenge: options.challenge} : {}),
      ...(options.domain ? {domain: options.domain} : {})
    };
    const vp = {...presentation, proof};
    const id = presentation.id ?? randomUUID();
    store.presentations.set(id, {vp, deleted: false});
    return res.status(201).json({verifiablePresentation: vp});
  });

  // GET /presentations
  router.get('/', (req, res) => {
    const {type} = req.query;
    const all = [...store.presentations.values()]
      .filter(e => !e.deleted)
      .map(e => e.vp);
    if(type === 'presentations') {
      return res.status(200).json(
        all.filter(vp => !vp.proof)
      );
    }
    if(type === 'verifiablepresentations') {
      return res.status(200).json(
        all.filter(vp => vp.proof)
      );
    }
    return res.status(200).json(all);
  });

  // GET /presentations/:id
  router.get('/:id', (req, res) => {
    const entry = store.presentations.get(req.params.id);
    if(!entry || entry.deleted) {
      return res.status(404).json(
        problemDetails(
          'not-found', 'Not Found', 404,
          `Presentation ${req.params.id} not found.`)
      );
    }
    return res.status(200).json(entry.vp);
  });

  // DELETE /presentations/:id
  router.delete('/:id', (req, res) => {
    const entry = store.presentations.get(req.params.id);
    if(!entry || entry.deleted) {
      return res.status(404).json(
        problemDetails(
          'not-found', 'Not Found', 404,
          `Presentation ${req.params.id} not found.`)
      );
    }
    entry.deleted = true;
    return res.status(202).send();
  });

  return router;
}
