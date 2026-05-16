const BASE_URL = 'https://vcalm.example/errors#';

/**
 * @typedef {object} ProblemDetails
 * @property {string} type
 * @property {string} title
 * @property {number} status
 * @property {string} detail
 */

/**
 * Creates a RFC 9457 ProblemDetails object.
 *
 * @param {string} slug - Error slug appended to base URL
 * @param {string} title - Short human-readable title
 * @param {number} status - HTTP status code
 * @param {string} detail - Specific human-readable detail message
 * @returns {ProblemDetails}
 */
export function problemDetails(slug, title, status, detail) {
  return {type: `${BASE_URL}${slug}`, title, status, detail};
}

/**
 * Express error handler middleware that formats errors as ProblemDetails.
 *
 * @param {ProblemDetails & Error} err
 * @param {import('express').Request} _req
 * @param {import('express').Response} res
 * @returns {void}
 */
export function errorHandler(err, _req, res) {
  const status = err.status || 500;
  if(err.type?.startsWith(BASE_URL)) {
    res.status(status).json(err);
    return;
  }
  res.status(status).json(
    problemDetails(
      'internal-error', 'Internal Server Error', status, err.message
    )
  );
}
