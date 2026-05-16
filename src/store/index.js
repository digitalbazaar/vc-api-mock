/** @typedef {import('../types.js').VerifiableCredential} VerifiableCredential */
/** @typedef {import('../types.js').VerifiablePresentation} VerifiablePresentation */
/** @typedef {import('../types.js').StatusListCredential} StatusListCredential */
/** @typedef {import('../types.js').WorkflowConfig} WorkflowConfig */

/**
 * @typedef {object} CredentialEntry
 * @property {VerifiableCredential} vc
 * @property {string[]} mandatoryPointers - Pointers marked mandatory at
 *   issuance
 * @property {boolean} deleted - Whether the credential has been soft-deleted
 */

/**
 * @typedef {object} PresentationEntry
 * @property {VerifiablePresentation} vp
 * @property {boolean} deleted - Whether the presentation has been soft-deleted
 */

/**
 * @typedef {object} ExchangeState
 * @property {string} id - Local exchange ID
 * @property {string} workflowId - Parent workflow ID
 * @property {number} sequence - Incremented on each POST
 * @property {string} step - Current step name
 * @property {'pending'|'active'|'complete'|'invalid'} state
 * @property {string|null} expires - ISO datetime string or null
 * @property {object} variables - Exchange variables
 * @property {object|null} lastError - Last ProblemDetails error
 */

/**
 * Creates a fresh isolated in-memory store.
 *
 * @returns {{
 *   credentials: Map<string, CredentialEntry>,
 *   presentations: Map<string, PresentationEntry>,
 *   workflows: Map<string, WorkflowConfig>,
 *   exchanges: Map<string, ExchangeState>,
 *   statusLists: Map<string, StatusListCredential>,
 *   challenges: Map<string, {expires: number}>
 * }}
 */
export function createStore() {
  return {
    credentials: new Map(),
    presentations: new Map(),
    workflows: new Map(),
    exchanges: new Map(),
    statusLists: new Map(),
    challenges: new Map()
  };
}
