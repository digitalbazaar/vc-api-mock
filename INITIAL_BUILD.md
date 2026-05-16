# Initial Build Summary

## What This Is

`vc-api-mock` is a mock HTTP server and conformance test suite for the
VCALM (Verifiable Credential API Lifecycle Management) spec, built on the
W3C VC API and VC Data Model 2.0 standards.

It serves two purposes:
- **Mock server** — a runnable stand-in for a real VCALM server, useful for
  development and integration testing without a live implementation
- **Conformance suite** — an HTTP test suite that can run against any VCALM
  server via `VCALM_BASE_URL`

---

## Stack

- JavaScript ESM (no TypeScript compilation — matches Digital Bazaar convention)
- Express 5 for HTTP
- Mocha + Node assert for tests
- JSDoc + `tsc --checkJs --noEmit` for type safety
- ESLint with `@digitalbazaar/eslint-config`
- Supertest for HTTP integration tests
- AJV + `@readme/openapi-parser` for OAS schema validation in conformance tests

---

## What Was Built

### Source (`src/`)

| File | Purpose |
|------|---------|
| `server.js` | Express app factory — no `listen` call, injectable store for test isolation |
| `index.js` | Entry point — calls `listen`, registers `unhandledRejection` handler |
| `types.js` | Shared JSDoc typedefs: `Proof`, `VerifiableCredential`, `VerifiablePresentation`, `StatusListCredential`, `WorkflowConfig`, `WorkflowStep` |
| `store/index.js` | In-memory store factory — credentials, presentations, workflows, exchanges, statusLists, challenges |
| `middleware/problemDetails.js` | RFC 9457 ProblemDetails error formatting and Express error handler |
| `utils/proof.js` | Deterministic fake proof (SHA-256 hash, no real crypto) + verification |
| `utils/pointers.js` | `computeMissing()` — enforces spec-level and issuer mandatory JSON pointers |
| `routes/credentials.js` | POST /issue, POST /verify, POST /derive, POST /status, GET /:id, DELETE /:id |
| `routes/presentations.js` | POST /verify, POST /, GET /, GET /:id, DELETE /:id |
| `routes/status.js` | POST /status-lists, GET /status-lists/:id |
| `routes/workflows.js` | Full workflow + exchange state machine |
| `routes/interactions.js` | POST /challenges, GET /interactions/:id |

### Tests (`test/`)

**Unit** (pure functions, no HTTP):
- `pointers.test.js` — `computeMissing` edge cases
- `proof.test.js` — proof generation and verification
- `store.test.js` — store isolation and CRUD

**Integration** (HTTP, fresh store per test):
- `credentials.test.js` — issue, verify, derive, status update, GET, DELETE lifecycle
- `presentations.test.js` — create, verify (with/without challenge), proofless verify, holder warning
- `status.test.js` — status list create/get, credential status update
- `interactions.test.js` — challenge single-use enforcement, interactions endpoint
- `workflows.test.js` — workflow CRUD, full exchange round-trips, expiry, redirectUrl rejection

**Conformance** (`test/conformance/`):
- `conformance.test.js` — 15 self-contained HTTP tests covering issuer, verifier, holder, derive, challenge, status list, and workflow roles. Runs against the local mock by default; point at a real server with `VCALM_BASE_URL`.
- `helpers.js` — shared agent factory and sample fixtures
- `validator.js` — AJV-backed response schema validator using `spec/oas.yaml`

### Spec (`spec/`)

- `oas.yaml` — Full OpenAPI 3.0 spec documenting every endpoint, request schema, response schema, and error response. Used by the conformance test validator to assert response shapes at runtime.

### Infrastructure

- `.github/workflows/ci.yml` — Node 18/20/22 matrix running lint + typecheck + test
- `.mocharc.cjs` — Mocha config (5s timeout, recursive glob)
- `eslint.config.js` — DB eslint config + Node/Mocha globals + `ignoreComments` for max-len

---

## Key Design Decisions

**Fake proof strategy** — SHA-256 hash of the credential content, prefixed
`mock-proof-`. Verification checks the prefix. Deterministic, so the same
credential always produces the same proof — useful for derive lookup by
proof value.

**Mandatory pointer enforcement** — `computeMissing()` unions spec-level
mandatory pointers (`/@context`, `/type`, `/issuer`, `/validFrom`) with any
issuer-specified `mandatoryPointers`. Derive returns 400 if `selectivePointers`
doesn't cover all of them.

**Store injection** — `createApp(store)` accepts an optional store override.
Every integration test calls `createApp(createStore())` in `beforeEach` for
full isolation with no shared state.

**Single-use challenges** — Nonces issued at `POST /challenges` are stored with
a 5-minute TTL and deleted on first use at `POST /presentations/verify`.

**redirectUrl rejection** — Always returns 400. The spec technically allows it
but it's fragile and real implementations avoid it.

**Unsigned presentation `holder` warning** — When a VP has a `holder` field
but no proof, a `console.warn` is logged and verification proceeds on enclosed
credentials only. This catches a common developer mistake silently.

**No `@type {any}` casts** — All routes use typed JSDoc intersections
(`Record<string, unknown> & {proof?: Proof}`) so tsc catches property typos.

---

## Test Counts

- 79 total tests (unit + integration + conformance)
- 15 conformance-only tests (`npm run test:conformance`)
- 0 lint errors, 0 tsc errors

---

## What Is Not Implemented

- Real cryptography (intentional — this is a mock)
- Persistent storage (in-memory only, resets on restart)
- Authentication/authorization on any endpoint
- `POST /:inviteId/invite-request/response` has a stub but no meaningful behavior
- Multi-step exchange variable passing between steps is stored but not used
