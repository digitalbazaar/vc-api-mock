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
| `bbs-2023` | BBS+ (BLS12-381) | Yes | Required for `/presentations/derive` |

> **Important:** Only `bbs-2023` supports selective disclosure. All other suites require the full credential to be presented.
