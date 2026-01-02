# Security Policy

We take the security of this software seriously. This document outlines our threat model and vulnerability disclosure process.

## Vulnerability Disclosure

**DO NOT** open public GitHub issues for security vulnerabilities.

If you discover a security issue, please report it via the **GitHub Security Advisories** "Report a vulnerability" tab on this repository. If that is unavailable, please contact the maintainers directly.

We agree to:
- Acknowledge your report within 48 hours.
- Provide a timeline for the fix.
- Credit you in the release notes (if desired) once the fix is deployed.

## Threat Model

Our security architecture assumes the server is **untrusted**.

### In Scope
- **End-to-End Encryption (E2EE)**: Implementation flaws in `lib/crypto` (Double Ratchet, ECDH, AES-GCM).
- **Identity Verification**: Issues with Trust On First Use (TOFU) or identity key pinning.
- **Message Integrity**: Modifications to ciphertext during transit.
- **Forward Secrecy**: Compromise of past sessions if current keys are exposed.
- **Transport Security**: WebSocket origin validation and payload limits.

### Out of Scope
- **Endpoint Compromise**: Malware or physical access to the user's device (browser extensions, screen readers, keyloggers).
- **Server Availability**: Denial of Service (DoS) attacks against the relay server (though we implement rate limiting).
- **Metadata Analysis**: Traffic analysis (message timing, size) is currently visible to the network observer.

## Security Architecture

### Cryptographic Primitives
We rely exclusively on the browser's **Web Crypto API** (`v1`):
- **Key Agreement**: ECDH (P-256)
- **Symmetric Encryption**: AES-GCM (256-bit)
- **Key Derivation**: HKDF (SHA-256)
- **Randomness**: `window.crypto.getRandomValues()`

### Transport Layer
- **WebSocket**: Messages are relayed ephemerally. The server does not write messages to disk.
- **Rate Limiting**: Enforced per connection (50 messages / 10 seconds).
- **Max Payload**: 64KB hard limit to prevent resource exhaustion.
- **Origin Validation**: Strict checking of `Origin` header in production.

### Data Persistence
- **Client**: Keys are stored in `IndexedDB`.
- **Server**: No persistence. Logs are sanitized of message content.

## Known Limitations

- **Metadata**: The server knows who is talking to whom and when.
- **Browser Context**: We run in a browser environment; we rely on the browser's sandbox and TLS implementation.

## Secure Development

- All dependencies are vetted for supply chain risks.
- We fail closed on all security errors.
