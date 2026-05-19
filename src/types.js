// Shared JSDoc typedefs for VCALM domain objects.
// Import in other files with e.g.:
//   @typedef {import('./types.js').Proof} Proof

/**
 * @typedef {object} Proof
 * @property {string} type - e.g. 'DataIntegrityProof'
 * @property {string} [cryptosuite] - e.g. 'eddsa-rdfc-2022'
 * @property {string} [verificationMethod]
 * @property {string} [created] - ISO datetime
 * @property {string} [proofPurpose]
 * @property {string} [proofValue]
 * @property {string} [challenge]
 * @property {string} [domain]
 */

// VerifiableCredential and VerifiablePresentation use Record<string, unknown>
// because '@context' is a valid JS property name but cannot be expressed as a
// JSDoc @property tag. The intersection adds typed access for the fields that
// matter most — proof, type, id.

/**
 * @typedef {Record<string, unknown> & {
 *   type: string|string[],
 *   id?: string,
 *   issuer?: string|object,
 *   validFrom?: string,
 *   issued?: string,
 *   credentialSubject?: Record<string, unknown>,
 *   proof?: Proof
 * }} VerifiableCredential
 */

/**
 * @typedef {Record<string, unknown> & {
 *   type: string|string[],
 *   id?: string,
 *   holder?: string,
 *   verifiableCredential?: VerifiableCredential[],
 *   proof?: Proof
 * }} VerifiablePresentation
 */

/**
 * @typedef {Record<string, unknown> & {
 *   id: string,
 *   type: string|string[],
 *   issuer: string,
 *   issued: string,
 *   credentialSubject: StatusListSubject,
 *   proof?: Proof
 * }} StatusListCredential
 */

/**
 * @typedef {object} StatusListSubject
 * @property {string} id
 * @property {string} type
 * @property {string} statusPurpose
 * @property {string} encodedList
 */

/**
 * @typedef {object} WorkflowStep
 * @property {object} [verifiablePresentationRequest]
 * @property {string[]} [issueRequests]
 * @property {string} [nextStep]
 */

/**
 * @typedef {object} WorkflowConfig
 * @property {string} id
 * @property {string} initialStep
 * @property {Record<string, WorkflowStep>} steps
 * @property {object[]} [credentialTemplates]
 */
