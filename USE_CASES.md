# VCALM Use Cases

A reference for real-world applications of the Verifiable Credential API Lifecycle Management (VCALM) protocol. Use this to guide mock server design, test fixture selection, and exchange flow implementation.

---

## Core Concepts

### Roles
- **Issuer** — signs and issues credentials (university, government agency, employer)
- **Holder** — stores credentials in a wallet and presents them
- **Verifier** — requests and verifies presentations

The key paradigm shift from traditional identity: the issuer is **not in the loop at verification time**. The holder carries the credential; the verifier checks the cryptographic proof directly.

### Single-Step vs. Multi-Step Exchanges
Most use cases are single-step: holder presents a credential, verifier accepts or rejects. Multi-step exchanges hold state across multiple round-trips, enabling progressive disclosure, step-up auth, and credential chaining.

---

## Single-Step Use Cases

### Digital Identity / Government IDs
Mobile driver's licenses, passport credentials. A holder presents to a bar, airport, or car rental without handing over a physical document. With BBS+ selective disclosure, the verifier receives only what they need (e.g., age verification) — not address, license number, or other claims.

**Flow:** `POST /workflows/{id}/exchanges` → holder presents → verifier accepts

---

### Employee Credentials
An employer issues a "works at Acme Corp" credential to the employee's DID. The employee presents it to a SaaS vendor for an enterprise discount, or to a background check service — without the vendor contacting HR directly.

**Flow:** Single presentation, no credential issued in return

---

### Education / Diplomas
A university issues a degree credential. A job applicant presents it directly to an employer. The employer verifies cryptographically — no transcript requests, no phone calls to the registrar.

**Flow:** Single presentation against an employer's verification endpoint

---

### Healthcare Records
A provider issues vaccination records or prescription credentials to a patient's wallet. The patient presents to any other provider. No faxing records between hospitals or manual release-of-information forms.

**Flow:** Single presentation; verifier may return an access token or confirmation

---

### KYC (Know Your Customer)
A bank verifies a user's identity once and issues a KYC credential. The user presents it to other fintechs to skip redundant verification — significant friction reduction in crypto and DeFi onboarding.

**Flow:** Single presentation; verifier grants account access on success

---

### Supply Chain Provenance
A factory issues a "certified organic" or "conflict-free materials" credential on a product batch. The credential travels with the product and any party in the supply chain can verify it independently.

**Flow:** Single presentation at each handoff point

---

## Multi-Step Use Cases

Multi-step exchanges use the VCALM workflow/exchange protocol to hold state across multiple round-trips. The verifier does not front-load its requirements — each step reveals the minimum needed for that stage.

---

### Step-Up Authentication
Progressive access based on what the holder can prove.

1. Present a "verified human" credential → receive read access
2. Present an employee credential → receive write access
3. Present an MFA or hardware key credential → receive admin access

Each step is only triggered when the user requests higher access. Most users never reach step 3, so their additional credentials are never disclosed unnecessarily.

**VCALM endpoints:** `POST /workflows/{id}/exchanges/{exchangeId}` (repeated per step)

---

### Credential Chaining (Present-to-Get)
Presenting one credential to receive another.

1. Present a university diploma credential
2. Issuer validates and returns an "alumni discount eligible" credential
3. Holder presents the new credential to the actual service

Common in government contexts: present a state ID → receive a federal benefits credential → present to a specific agency program.

**VCALM endpoints:** Exchange returns a new VC in the response body at step 2

---

### Progressive Disclosure with BBS+
Using selective disclosure across multiple steps within a single exchange. (For an overview of BBS+ and other cryptosuites, see [Cryptosuite Reference](#cryptosuite-reference) below.)

1. Present minimal claims (over 18, US resident)
2. Verifier responds: insufficient, also need proof of employment
3. Holder presents employment credential in the same exchange

The exchange retains state so the verifier can reason across all presented credentials together. BBS+ ensures each step reveals only the claims required for that step.

**VCALM endpoints:** `POST /presentations/derive` to generate each selective disclosure proof

---

### KYC Tiering
Incremental account upgrades driven by the holder's needs, not upfront demands.

1. Present basic identity → open a low-limit account
2. Present proof of address + income → upgrade account limits
3. Present accredited investor credential → unlock investment products

Each step is triggered when the user wants more access. Privacy is preserved because the holder never discloses more than necessary for their current goal.

**VCALM endpoints:** Each tier upgrade initiates a new exchange on the same workflow

---

## Cryptosuite Reference

| Suite | Key Type | Selective Disclosure | Notes |
|---|---|---|---|
| `Ed25519Signature2020` | Ed25519 | No | Most common; fast, small signatures |
| `eddsa-rdfc-2022` | Ed25519 / Ed448 | No | Newer RDF canonicalization variant |
| `ecdsa-rdfc-2019` | P-256 / P-384 | No | Required for some government/enterprise contexts |
| `ecdsa-sd-2023` | P-256 | Yes (linkable) | ECDSA-based selective disclosure via JSON Pointers; requires `/presentations/derive` |
| `bbs-2023` | BBS+ (BLS12-381) | Yes (unlinkable) | Unlinkable selective disclosure; required for privacy-preserving `/presentations/derive` |

> **Important:** Both `ecdsa-sd-2023` and `bbs-2023` support selective disclosure and require `POST /presentations/derive` to generate a derived (holder) proof. The key difference is **linkability**: `ecdsa-sd-2023` derived proofs are linkable (each disclosure uses the same base signature and public key, so multiple presentations of the same credential can be correlated), while `bbs-2023` derived proofs are unlinkable (each presentation is cryptographically independent). Use `ecdsa-sd-2023` when you need ECDSA compatibility (e.g., government or enterprise environments that mandate P-256 keys) and linkability is acceptable. Use `bbs-2023` when holder privacy and unlinkability are the primary concern.

### How `ecdsa-sd-2023` Selective Disclosure Works

`ecdsa-sd-2023` implements selective disclosure using a two-phase proof model defined in the [W3C VC Data Integrity ECDSA specification](https://w3c.github.io/vc-di-ecdsa/#selective-disclosure-functions):

1. **Base proof (issuer → holder):** The issuer signs the credential with a long-term key and also generates a per-proof ephemeral P-256 key pair. The issuer signs each individual statement (N-Quad) in the credential with the ephemeral private key, producing a separate signature per statement. Mandatory claims (specified via JSON Pointers) are hashed together; the rest remain individually signed but undisclosed. The base proof is given only to the holder — it is never sent to a verifier.

2. **Derived proof (holder → verifier):** The holder calls `POST /presentations/derive`, supplying the base proof and a set of JSON Pointers indicating which additional (non-mandatory) claims to reveal. The derived proof includes only the signatures for the selected statements, a label map (mapping canonical blank node IDs to HMAC-randomized IDs), and the mandatory claim indexes. The verifier receives only the revealed claims and can independently verify each statement's signature and the mandatory claim hash.

**Key technical properties:**
- Uses **HMAC-based blank node relabeling** to prevent information leakage from blank node ordering
- Mandatory claims are always disclosed; selective claims are opt-in by the holder
- Proof values are CBOR-encoded and Multibase (base64url-no-pad) encoded
- Canonicalization uses RDF Dataset Canonicalization (RDFC-1.0) with SHA-256
- Does **not** provide unlinkable disclosure — see `bbs-2023` if unlinkability is required
