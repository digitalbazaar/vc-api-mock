/**
 * JSON pointer utilities for selective disclosure validation.
 */

/** @type {string[]} */
export const SPEC_MANDATORY_POINTERS = [
  '/@context', '/type', '/issuer', '/validFrom'
];

/**
 * Computes the set of mandatory pointers not covered by selective pointers.
 * Always includes spec-level mandatory pointers regardless of issuer
 * configuration.
 *
 * @param {string[]} mandatoryPointers - Pointers the issuer marked mandatory
 *   at issuance
 * @param {string[]} selectivePointers - Pointers the holder wants to reveal
 * @returns {string[]} Pointers that are mandatory but not in selectivePointers
 */
export function computeMissing(mandatoryPointers, selectivePointers) {
  const allMandatory = new Set(
    [...SPEC_MANDATORY_POINTERS, ...mandatoryPointers]
  );
  const selective = new Set(selectivePointers);
  return [...allMandatory].filter(p => !selective.has(p));
}
