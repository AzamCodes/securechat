# Contributing to SecureChat

We welcome contributions from security engineers, cryptographers, and frontend developers who accept our zero-compromise approach to user privacy.

## Project Philosophy

1.  **Zero Trust Architecture**: The server is an untrusted relay. It must never see plaintext, keys, or persistent metadata.
2.  **Fail-Closed**: If a security check fails (identity mismatch, signature error, origin validation), the operation must abort immediately. We do not degrade to "less secure" modes.
3.  **Client-Side Sovereignty**: All cryptographic operations occur in `lib/crypto` or dedicated workers. Keys are generated and stored locally (IndexedDB/Web Crypto).
4.  **No Persistence**: Messages are transient. We do not store history on the server.

## Development Setup

The project is a monorepo-style structure containing both the Next.js frontend and the WebSocket relay server.

### Prerequisites

- Node.js 18+ (LTS)
- npm 9+

### Quick Start

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Start the development environment**:
    ```bash
    npm run dev
    ```
    This command uses `concurrently` to launch:
    - **Frontend**: `http://localhost:3000` (Next.js)
    - **Relay Server**: `ws://localhost:3001` (WebSocket)

## Contribution Guidelines

### Cryptography & Security
**Strict Rule**: Do not roll your own crypto.

- Use **Web Crypto API** (`window.crypto.subtle`) for all cryptographic primitives.
- Modifications to `lib/crypto/ratchet.ts` or `lib/crypto/utils.ts` require a comprehensive security rationale in the Pull Request description.
- Do not introduce external cryptographic libraries (e.g., `tweetnacl`, `crypto-js`) without explicit maintainer consensus. We aim to minimize supply chain attack surface.

### Pull Request Standards

1.  **Security Impact Analysis**: Every PR must state whether it impacts the threat model.
2.  **Strict Typing**: No `any`. All WebSocket messages must be typed via the `WebSocketMessage` interface.
3.  **Dependencies**: We pin dependencies. New packages are scrutinized strictly. Visualization libraries or UI kits must be tree-shakeable and zero-dependency where possible.

## Architecture Overview

- **Frontend**: Next.js 15 (App Router). Stores identity keys in IndexedDB.
- **WebSocket Server**: `ws-server.ts`. Stateless relay. Enforces rate limits (50 msgs/10s) and Origin validation.
- **Protocol**: Custom JSON wire protocol over WebSocket.
- **Encryption**: Double Ratchet implementation (AES-GCM-256 for messages, ECDH P-256 for key agreement).

## Out-of-Scope Features

Features that violate our security model will be rejected:
- Server-side message history limits (we store nothing).
- "Password recovery" via server (impossible by design).
- Analytics or tracking scripts.
- Social login providers (unless essentially used as a dumb OIDC identity provider without data sharing).

Thank you for helping us build a private, sovereign communication tool.
