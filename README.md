# vc-api-mock

A mock server and test suite for the VCALM (Verifiable Credential API
Lifecycle Management) HTTP API, based on the
[W3C VC API](https://w3c-ccg.github.io/vc-api/) and
[W3C VC Data Model 2.0](https://www.w3.org/TR/vc-data-model-2.0/).

Use it to develop against VCALM APIs without a real implementation, or as a
learning tool for understanding the full VC lifecycle.

## Installation

```sh
npm install
```

## Quick Start

```sh
node src/index.js
```

The server listens on port 3000 by default. Set `PORT` to override.

## Usage

### Issue a credential

```sh
curl -X POST http://localhost:3000/credentials/issue \
  -H 'Content-Type: application/json' \
  -d '{
    "credential": {
      "@context": ["https://www.w3.org/ns/credentials/v2"],
      "type": ["VerifiableCredential"],
      "issuer": "did:example:alice",
      "validFrom": "2024-01-01T00:00:00Z",
      "credentialSubject": {"id": "did:example:bob", "name": "Bob"}
    }
  }'
```

### Verify a credential

```sh
curl -X POST http://localhost:3000/credentials/verify \
  -H 'Content-Type: application/json' \
  -d '{"verifiableCredential": <vc>}'
```

### Derive (selective disclosure)

```sh
curl -X POST http://localhost:3000/credentials/derive \
  -H 'Content-Type: application/json' \
  -d '{
    "verifiableCredential": <vc>,
    "options": {
      "selectivePointers": ["/@context", "/type", "/issuer", "/validFrom"]
    }
  }'
```

## Endpoints

### Credentials

| Method | Path | Description |
|--------|------|-------------|
| POST | `/credentials/issue` | Issue a credential with a mock proof |
| POST | `/credentials/verify` | Verify a credential |
| POST | `/credentials/derive` | Selective disclosure derivation |
| POST | `/credentials/status` | Update a credential's status |
| GET | `/credentials/:id` | Retrieve a stored credential |
| DELETE | `/credentials/:id` | Soft-delete a credential |

### Presentations

| Method | Path | Description |
|--------|------|-------------|
| POST | `/presentations` | Create a presentation |
| POST | `/presentations/verify` | Verify a presentation |
| GET | `/presentations` | List stored presentations |
| GET | `/presentations/:id` | Retrieve a presentation |
| DELETE | `/presentations/:id` | Soft-delete a presentation |

### Challenges & Status Lists

| Method | Path | Description |
|--------|------|-------------|
| POST | `/challenges` | Issue a single-use nonce |
| POST | `/status-lists` | Create a StatusList2021 credential |
| GET | `/status-lists/:id` | Retrieve a status list (public, no auth) |

### Workflows & Exchanges

Exchanges are stateful. State transitions: `pending → active → complete` (or
`invalid` on error). See [Design Notes](#design-notes) for the full state
machine.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/workflows` | Create a workflow |
| GET | `/workflows/:id` | Retrieve a workflow |
| POST | `/workflows/:id/exchanges` | Create an exchange |
| GET | `/workflows/:id/exchanges/:id` | Get exchange state |
| POST | `/workflows/:id/exchanges/:id` | Participate in an exchange |
| GET | `/workflows/:id/exchanges/:id/protocols` | Get supported protocol URLs |

### Interactions

| Method | Path | Description |
|--------|------|-------------|
| GET | `/interactions/:id?iuv=1` | Get interaction protocols (`iuv=1` required) |

## Options

**`PORT`** — TCP port to listen on (default: `3000`)

## Running Tests

```sh
npm test                  # unit + integration + conformance tests
npm run test:conformance  # conformance suite only (supports VCALM_BASE_URL)
npm run lint              # lint src and test
npm run typecheck         # JSDoc type checking via tsc
```

To run the conformance suite against a real VCALM server:

```sh
VCALM_BASE_URL=https://your-server.example npm run test:conformance
```

The full OpenAPI 3.0 spec is at [`spec/oas.yaml`](spec/oas.yaml).

## Design Notes

- **No real cryptography.** Proofs are deterministic SHA-256 hashes prefixed with `mock-proof-`. Verification checks the prefix — sufficient for round-trip tests, not for production use.
- **In-memory store.** All state is lost on restart.
- **Single-use challenges.** Nonces issued via `POST /challenges` are consumed on first use at `/presentations/verify`.
- **`redirectUrl` is not supported.** Returns `400` per spec guidance that implementations should reject it.
- **Unsigned presentation `holder` field is ignored.** A warning is logged when `holder` is present but no presentation-level proof exists.

## Contributing

See [the contribute file](https://github.com/digitalbazaar/bedrock/blob/master/CONTRIBUTING.md)!

PRs accepted.

If editing the Readme, please conform to the
[standard-readme](https://github.com/RichardLitt/standard-readme) specification.

## License

[New BSD License (3-clause)](LICENSE) © Digital Bazaar
