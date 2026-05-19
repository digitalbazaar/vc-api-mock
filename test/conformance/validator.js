/**
 * Response schema validator backed by spec/oas.yaml.
 *
 * Usage:
 *   import {validateResponse} from './validator.js';
 *   validateResponse('VerifiableCredential', res.body); // throws on mismatch
 */

import Ajv from 'ajv';
import {dereference} from '@readme/openapi-parser';

import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = resolve(__dirname, '../../spec/oas.yaml');

/** @type {Record<string, unknown> | null} */
let _api = null;

/** @type {InstanceType<typeof Ajv> | null} */
let _ajv = null;

async function load() {
  if(_api) {
    return;
  }
  _api = /** @type {Record<string, unknown>} */ (
    await dereference(SPEC_PATH)
  );
  _ajv = new Ajv({allErrors: true});
}

/**
 * Validates a response body against a named schema from spec/oas.yaml.
 * Throws an AssertionError-style Error if validation fails.
 *
 * @param {string} schemaName - Key from components.schemas (e.g.
 *   'VerifiableCredential')
 * @param {unknown} body - The parsed response body to validate
 */
export async function validateResponse(schemaName, body) {
  await load();
  const schema =
    /** @type {any} */ (_api)?.components?.schemas?.[schemaName];
  if(!schema) {
    throw new Error(
      `Schema '${schemaName}' not found in spec/oas.yaml components.schemas`
    );
  }
  const ajv = /** @type {InstanceType<typeof Ajv>} */ (_ajv);
  const valid = ajv.validate(schema, body);
  if(!valid) {
    const errors = ajv.errors
      ?.map(
        e => `  ${/** @type {any} */ (e).instancePath || '(root)'} ${e.message}`
      )
      .join('\n');
    throw new Error(
      `Response does not match schema '${schemaName}':\n${errors}`
    );
  }
}
