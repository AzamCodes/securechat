
# Secure Chat - Next.js Enterprise-Grade E2EE Messaging

**Production-ready, zero-knowledge, end-to-end encrypted messaging.**
Built with **Next.js 15**, **React 19**, **TypeScript**, **Web Crypto API**, and **PWA**.

![Status](https://img.shields.io/badge/status-hardened_v3-green.svg)
![Security](https://img.shields.io/badge/crypto-double_ratchet-purple.svg)
![PWA](https://img.shields.io/badge/PWA-Enhanced-blue.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

---

## 🚀 Key Features (V3 Hardened)

### 🔐 Maximum Security
- **Double Ratchet Protocol**: Signal-style encryption offering **Forward Secrecy** (compromised keys can't read past messages) and **Post-Compromise Security** (healing).
- **Crypto Isolation**: All sensitive key operations run in a dedicated **Web Worker** (`public/worker.js`), ensuring main thread vulnerabilities (XSS) cannot easily extract keys.
- **Trust On First Use (TOFU)**: Identity Keys are generated once and pinned in **IndexedDB**.
- **JIT Handshake**: Just-In-Time Key Exchange allows you to chat immediately by pasting a Peer ID.

### � **NEW: Progressive Web App (PWA)**
- **Installable**: Full "Add to Home Screen" support as a native-like app.
- **Security-First Caching**: Custom Service Worker (`sw.js`) explicitly **excludes** crypto logic and keys from cache to ensure freshness, while speeding up UI assets.
- **Offline Shell**: Application loads instantly even offline (though messaging requires network).

### ✨ Advanced Features
- **Remote Edit & Recall**: Securely **Edit** or **Delete** sent messages. These actions are encrypted and propagated to peers automatically.
- **Self-Destruct**: "Read Once" (Burn-on-read) and Timer-based expiration support.
- **Traffic Analysis Resistance**: Messages padded to fixed 256-byte buckets.
- **Metadata Protection**: Random "Jitter" (0-300ms) obscures typing patterns.

### 🛡️ Defense in Depth
- **Strict Transport**: Enforced **HSTS**, **CSP**, and **Anti-CSWSH** (Origin Verification).
- **Audit Logs**: Built-in local security event logging at `/security/events`.
- **No Login**: Anonymity by default. No email, phone, or serverside database.

---

## 🛠️ Quick Start

### 1. Installation
```bash
git clone <your-repo-url>
cd securechat
npm install
```

### 2. Run Development Server
This starts **Next.js** (Port 3000) and **WebSocket Relay** (Port 3001) concurrently.
```bash
npm run dev
```

### 3. Access
Open [http://localhost:3000](http://localhost:3000).

> **Note**: You will see a dedicated WebSocket server running on port 3001. This is the **Zero-Knowledge Relay**. It blindly passes encrypted packets.

---

## 🔧 Troubleshooting

### "Address in use" (EADDRINUSE)
If the server fails to start because port 3000/3001 is busy:
```bash
# Kill stuck processes (Linux/Mac)
fuser -k 3000/tcp 3001/tcp
# Then restart
npm run dev
```

### "Target peer not connected"
This means the **Peer ID** you are trying to message is offline or invalid (peers are ephemeral).
*   **Fix**: Ask the peer to refresh and share their **new ID**.

### "WebSocket Connection Failed"
Ensure the WebSocket server is running `npm run ws:dev` (included in `npm run dev`).

---

## 🏗️ Architecture

```
securechat/
├── app/                  
│   ├── page.tsx          # Client Logic (UI)
│   ├── security/         # Threat Model & Events Log
│   └── layout.tsx        # Security Headers & PWA Register
├── components/           # UI Components (Bubble, Sidebar)
├── hooks/                
│   └── useSecureChat.ts  # Crypto Logic & Protocol Orchestration
├── lib/
│   ├── storage/          # IndexedDB Wrapper
│   └── security/         # Audit Tools
├── public/
│   ├── worker.js         # ISOLATED Crypto Worker (State & Keys)
│   ├── sw.js             # Security-First Service Worker
│   └── manifest.json     # PWA Manifest
├── ws-server.ts          # Relay Server (Port 3001)
└── next.config.js        # Strict CSP
```

---

## 🌍 Deployment

### 1. Environment Variables
Create `.env.local` for production overrides:
```env
NEXT_PUBLIC_WS_URL=wss://your-domain.com
WS_PORT=3001
```

### 2. Production Build
```bash
npm run build
npm start
```
*   **Reverse Proxy**: You MUST use Nginx/Caddy to terminate TLS (HTTPS) and forward WebSocket `Upgrade` headers.
*   **HTTPS**: Web Crypto API **requires** HTTPS (or localhost).

---

## 📜 Credits & License
*   **Protocol**: Based on the Double Ratchet Algorithm by Signal.
*   **Crypto**: Native Web Crypto API (SubtleCrypto).
*   **License**: MIT.
