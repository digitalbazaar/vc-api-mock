import {generateProof} from '../utils/proof.js';
import {problemDetails} from '../middleware/problemDetails.js';
import {randomUUID} from 'node:crypto';
import {Router} from 'express';

/** @typedef {import('../types.js').StatusListCredential} StatusListCredential */

/**
 * @param {import('../store/index.js').createStore extends
 *   (...args: any[]) => infer R ? R : never} store
 * @returns {Router}
 */
export function statusRouter(store) {
  const router = Router();

  // POST /status-lists
  router.post('/', (req, res) => {
    const {statusPurpose, id, options = {}} = req.body ?? {};
    if(!statusPurpose) {
      return res.status(400).json(
        problemDetails(
          'invalid-input', 'Invalid Input', 400,
          'Request body must include a statusPurpose property.')
      );
    }

    const listId =
      id ?? `https://vcalm.example/status-lists/${randomUUID()}`;
    const statusListCredential = /** @type {StatusListCredential} */ ({
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://w3id.org/vc/status-list/2021/v1'
      ],
      id: listId,
      type: ['VerifiableCredential', 'StatusList2021Credential'],
      issuer: 'did:example:mock',
      issued: new Date().toISOString(),
      credentialSubject: {
        id: `${listId}#list`,
        type: 'StatusList2021',
        statusPurpose,
        encodedList:
          'H4sIAAAAAAAAA-3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAA' +
          'AAAAAAAIC3AYbSVKsAQAAA',
        ...options
      }
    });
    statusListCredential.proof = generateProof(statusListCredential);
    store.statusLists.set(listId, statusListCredential);

    res.setHeader('Location', listId);
    return res.status(201).json(
      {id: listId, verifiableCredential: statusListCredential}
    );
  });

  // GET /status-lists/:id — intentionally public (no auth)
  router.get('/:id', (req, res) => {
    // Reconstruct the full ID from path since it may contain slashes
    const id = decodeURIComponent(req.params.id);
    const statusList = store.statusLists.get(id);
    if(!statusList) {
      return res.status(404).json(
        problemDetails(
          'not-found', 'Not Found', 404,
          `Status list ${id} not found.`)
      );
    }
    return res.status(200).json(statusList);
  });

  return router;
}
