import {generateProof, verifyProof} from '../utils/proof.js';
import {computeMissing} from '../utils/pointers.js';
import {problemDetails} from '../middleware/problemDetails.js';
import {randomUUID} from 'node:crypto';
import {Router} from 'express';

/** @typedef {import('../types.js').VerifiableCredential} VerifiableCredential */

/**
 * @param {import('../store/index.js').createStore extends
 *   (...args: any[]) => infer R ? R : never} store
 * @returns {Router}
 */
export function credentialsRouter(store) {
  const router = Router();

  // POST /credentials/issue
  router.post('/issue', (req, res) => {
    const {credential, options = {}} = req.body ?? {};
    if(!credential) {
      return res.status(400).json(
        problemDetails(
          'invalid-input', 'Invalid Input', 400,
          'Request body must include a credential property.')
      );
    }

    const credentialId =
      options.credentialId ?? credential.id ?? randomUUID();
    const mandatoryPointers = options.mandatoryPointers ?? [];
    const vc = {...credential, proof: generateProof(credential)};

    store.credentials.set(
      credentialId, {vc, mandatoryPointers, deleted: false}
    );
    return res.status(201).json(vc);
  });

  // POST /credentials/verify
  router.post('/verify', (req, res) => {
    const {verifiableCredential} = req.body ?? {};
    if(!verifiableCredential) {
      return res.status(400).json(
        problemDetails(
          'invalid-input', 'Invalid Input', 400,
          'Request body must include a verifiableCredential property.')
      );
    }
    const verified = verifyProof(verifiableCredential);
    return res.status(200).json({verified, results: []});
  });

  // POST /credentials/derive
  router.post('/derive', (req, res) => {
    const {verifiableCredential, options = {}} = req.body ?? {};
    if(!verifiableCredential) {
      return res.status(400).json(
        problemDetails(
          'invalid-input', 'Invalid Input', 400,
          'Request body must include a verifiableCredential property.')
      );
    }

    // Find stored mandatory pointers — check options.credentialId, then
    // credential.id, then fall back to scanning the store for a VC whose
    // content matches
    const vc =
      /** @type {VerifiableCredential} */ (verifiableCredential);
    const lookupId = options.credentialId ?? vc.id;
    let entry = lookupId ? store.credentials.get(lookupId) : null;
    if(!entry) {
      // Scan store for matching VC by proof value (deterministic hash)
      const proofValue = vc.proof?.proofValue;
      if(proofValue) {
        for(const e of store.credentials.values()) {
          if(e.vc.proof?.proofValue === proofValue) {
            entry = e;
            break;
          }
        }
      }
    }
    const storedMandatory = entry?.mandatoryPointers ?? [];

    const selectivePointers = options.selectivePointers ?? [];
    const missing = computeMissing(storedMandatory, selectivePointers);

    if(missing.length > 0) {
      return res.status(400).json(
        problemDetails(
          'missing-mandatory-pointers', 'Missing Mandatory Pointers', 400,
          `selectivePointers must include all mandatoryPointers: ` +
          `${missing.join(', ')}`)
      );
    }

    // Build derived credential with only selective fields + proof
    const vcRecord =
      /** @type {VerifiableCredential} */ (verifiableCredential);
    const derived = /** @type {VerifiableCredential} */ (Object.fromEntries(
      selectivePointers
        .map((/** @type {string} */ pointer) => {
          const key = pointer.replace(/^\//, '');
          return [key, vcRecord[key]];
        })
        .filter((/** @type {[string, unknown]} */ [, v]) => v !== undefined)
    ));
    derived.proof = generateProof(derived);
    return res.status(201).json(derived);
  });

  // POST /credentials/status — update a credential's status entry
  router.post('/status', (req, res) => {
    const {credentialId, credentialStatus} = req.body ?? {};
    if(!credentialId || !credentialStatus) {
      return res.status(400).json(
        problemDetails(
          'invalid-input', 'Invalid Input', 400,
          'Request body must include credentialId and credentialStatus.')
      );
    }
    const entry = store.credentials.get(credentialId);
    if(!entry || entry.deleted) {
      return res.status(404).json(
        problemDetails(
          'not-found', 'Not Found', 404,
          `Credential ${credentialId} not found.`)
      );
    }
    entry.vc.credentialStatus = credentialStatus;
    return res.status(200).json({});
  });

  // GET /credentials/:id
  router.get('/:id', (req, res) => {
    const entry = store.credentials.get(req.params.id);
    if(!entry || entry.deleted) {
      return res.status(404).json(
        problemDetails(
          'not-found', 'Not Found', 404,
          `Credential ${req.params.id} not found.`)
      );
    }
    return res.status(200).json(entry.vc);
  });

  // DELETE /credentials/:id
  router.delete('/:id', (req, res) => {
    const entry = store.credentials.get(req.params.id);
    if(!entry || entry.deleted) {
      return res.status(404).json(
        problemDetails(
          'not-found', 'Not Found', 404,
          `Credential ${req.params.id} not found.`)
      );
    }
    entry.deleted = true;
    return res.status(202).send();
  });

  return router;
}
