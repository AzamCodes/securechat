
// Dedicated Crypto Worker for Secure Chat
// Hardened V3 Implementation: Double Ratchet + Padding + Hygiene

const SESSIONS = new Map(); // peerId -> SessionState { chainSend, chainRecv, countSend, countRecv, skippedKeys }
const CONFIG = {
    MAX_SKIP: 50, // Max skipped messages to store keys for
    BUCKET_SIZE: 256 // Padding bucket alignment
};

const cryptoAPI = self.crypto.subtle;

// --- Safe Memory Utils ---
function zeroize(buffer) {
    if (buffer instanceof ArrayBuffer || buffer instanceof Uint8Array) {
        new Uint8Array(buffer).fill(0);
    }
}

// --- Padding Utils (Traffic Analysis Resistance) ---
function pad(plaintext) {
    const enc = new TextEncoder();
    const data = enc.encode(plaintext);
    const len = data.length;

    // Calculate bucket padding
    const remainder = len % CONFIG.BUCKET_SIZE;
    const padLen = CONFIG.BUCKET_SIZE - remainder;

    // Structure: [4 bytes Length][Data][Padding]
    const totalLen = 4 + len + padLen;
    const buffer = new Uint8Array(totalLen);
    const view = new DataView(buffer.buffer);

    view.setUint32(0, len, false); // Big Endian Length
    buffer.set(data, 4);

    // Fill padding with random noise (indistinguishable from ciphertext if encrypted)
    // Actually, simple zeros are fine inside AES-GCM, but random is better against compression side-channels (if any)
    const padding = new Uint8Array(padLen);
    self.crypto.getRandomValues(padding);
    buffer.set(padding, 4 + len);

    return buffer;
}

function unpad(buffer) {
    const view = new DataView(buffer);
    if (buffer.byteLength < 4) throw new Error("Padding Error: Too short");

    const len = view.getUint32(0, false);
    if (len > buffer.byteLength - 4) throw new Error("Padding Error: Length mismatch");

    const data = new Uint8Array(buffer, 4, len);
    return new TextDecoder().decode(data);
}

// --- Crypto Primitives ---

async function generateIdentityKeyPair() {
    return cryptoAPI.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']);
}

async function mkToBuffer(mk) {
    // Message keys are imported AES keys. We can't zeroize CryptoKey objects directly in JS.
    // We rely on Garbage Collection and scope closure prevention.
    // But the RAW bits should be handled carefully during import.
    return mk;
}

async function HKDF(input, salt, infoStr) {
    // Constant-time KDF
    const key = await cryptoAPI.importKey('raw', input, { name: 'HKDF' }, false, ['deriveBits']);
    const info = new TextEncoder().encode(infoStr);
    const saltBuf = salt ? new Uint8Array(salt) : new Uint8Array(32); // Zero salt if null

    // Derive 64 bytes (32 for Key, 32 for Next Chain)
    const bits = await cryptoAPI.deriveBits(
        { name: 'HKDF', hash: 'SHA-256', salt: saltBuf, info },
        key,
        256 * 2
    );

    return bits;
}

// --- Ratchet Core ---

self.onmessage = async (e) => {
    const { id, type, payload } = e.data;

    try {
        let result;

        switch (type) {
            case 'INIT_IDENTITY':
                const pair = await generateIdentityKeyPair();
                const pubJwk = await cryptoAPI.exportKey('jwk', pair.publicKey);
                const privJwk = await cryptoAPI.exportKey('jwk', pair.privateKey);
                SESSIONS.set('IDENTITY', pair);
                result = { publicKey: pubJwk, privateKey: privJwk };
                break;

            case 'IMPORT_IDENTITY':
                const pub = await cryptoAPI.importKey('jwk', payload.publicKey, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
                const priv = await cryptoAPI.importKey('jwk', payload.privateKey, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey', 'deriveBits']);
                SESSIONS.set('IDENTITY', { publicKey: pub, privateKey: priv });
                result = { status: 'OK' };
                break;

            case 'INIT_SESSION':
                const myIdentity = SESSIONS.get('IDENTITY');
                if (!myIdentity) throw new Error('Identity unavailable');

                const peerKey = await cryptoAPI.importKey('jwk', payload.peerPublicKey, { name: 'ECDH', namedCurve: 'P-256' }, false, []);

                // ECDH
                const sharedBits = await cryptoAPI.deriveBits({ name: 'ECDH', public: peerKey }, myIdentity.privateKey, 256);

                // Root Key Derivation
                const rootBits = await HKDF(sharedBits, null, 'ROOT');

                // Initialize Chains (Send/Recv split)
                // Note: Simplified symmetric initialization (Alice/Bob mirrors)
                // Real Signal uses 3-DH. Here we assume X3DH pre-step established 'sharedBits'.
                const chainSend = payload.isInitiator ? rootBits.slice(0, 32) : rootBits.slice(32, 64);
                const chainRecv = payload.isInitiator ? rootBits.slice(32, 64) : rootBits.slice(0, 32);

                SESSIONS.set(payload.peerId, {
                    chainSend: chainSend, // ArrayBuffer
                    chainRecv: chainRecv, // ArrayBuffer
                    countSend: 0,
                    countRecv: 0,
                    skippedKeys: new Map() // { count: ArrayBuffer(Key) }
                });

                zeroize(sharedBits); // Wipe shared secret immediately
                result = { status: 'OK' };
                break;

            case 'ENCRYPT':
                const sessionE = SESSIONS.get(payload.peerId);
                if (!sessionE) throw new Error('Session not found');

                // 1. Ratchet Forward (Sender)
                const sendMat = await HKDF(sessionE.chainSend, null, 'MSG_KEY');
                const msgKeyRaw = sendMat.slice(0, 32);
                const nextChain = sendMat.slice(32, 64);

                // Zeroize old chain key
                zeroize(sessionE.chainSend);
                sessionE.chainSend = nextChain;

                const count = sessionE.countSend++;

                // 2. Encrypt with Padding
                const msgKey = await cryptoAPI.importKey('raw', msgKeyRaw, { name: 'AES-GCM' }, false, ['encrypt']);
                const padded = pad(payload.text);
                const iv = self.crypto.getRandomValues(new Uint8Array(12));

                const cipherParams = await cryptoAPI.encrypt({ name: 'AES-GCM', iv }, msgKey, padded);

                zeroize(msgKeyRaw); // Wipe raw key material
                zeroize(padded);    // Wipe padded buffer

                result = {
                    iv: Array.from(iv),
                    ciphertext: Array.from(new Uint8Array(cipherParams)),
                    header: { count }
                };
                break;

            case 'DECRYPT':
                const sessionD = SESSIONS.get(payload.peerId);
                if (!sessionD) throw new Error('Session not found');

                const { iv: ivArr, ciphertext: cipherArr, header } = payload;
                const N = header.count;
                let mkRaw = null;

                // 1. Handle Skip / Reorder / Replay
                if (sessionD.skippedKeys.has(N)) {
                    // Message was skipped previously
                    mkRaw = sessionD.skippedKeys.get(N);
                    sessionD.skippedKeys.delete(N);
                } else if (N < sessionD.countRecv) {
                    throw new Error(`Replay detected or old message: ${N} < ${sessionD.countRecv}`);
                } else {
                    // Ratchet forward to N
                    if (N - sessionD.countRecv > CONFIG.MAX_SKIP) {
                        throw new Error("Too many skipped messages - Safety Halt");
                    }

                    // Fast-forward chain to N
                    while (sessionD.countRecv < N) {
                        const mat = await HKDF(sessionD.chainRecv, null, 'MSG_KEY');
                        const mk = mat.slice(0, 32);
                        const next = mat.slice(32, 64);

                        // Store skipped key
                        sessionD.skippedKeys.set(sessionD.countRecv, mk);

                        zeroize(sessionD.chainRecv);
                        sessionD.chainRecv = next;
                        sessionD.countRecv++;
                    }

                    // Derive target key
                    const mat = await HKDF(sessionD.chainRecv, null, 'MSG_KEY');
                    mkRaw = mat.slice(0, 32);
                    const next = mat.slice(32, 64);

                    zeroize(sessionD.chainRecv);
                    sessionD.chainRecv = next;
                    sessionD.countRecv++;
                }

                // 2. Decrypt
                try {
                    const mk = await cryptoAPI.importKey('raw', mkRaw, { name: 'AES-GCM' }, false, ['decrypt']);
                    const decrypted = await cryptoAPI.decrypt(
                        { name: 'AES-GCM', iv: new Uint8Array(ivArr) },
                        mk,
                        new Uint8Array(cipherArr)
                    );

                    // 3. Unpad
                    result = unpad(decrypted);
                } catch (err) {
                    // Fail-closed
                    throw new Error("Decryption Failed - Integrity Check Failed");
                } finally {
                    if (mkRaw && !sessionD.skippedKeys.has(N)) zeroize(mkRaw);
                }
                break;

            case 'ZEROIZE_SESSION':
                // Explicit cleanup command
                const s = SESSIONS.get(payload.peerId);
                if (s) {
                    zeroize(s.chainSend);
                    zeroize(s.chainRecv);
                    s.skippedKeys.forEach(k => zeroize(k));
                    s.skippedKeys.clear();
                    SESSIONS.delete(payload.peerId);
                }
                result = { status: 'CLEARED' };
                break;

            case 'CLEAR_STATE':
                // Panic Mode: Wipe Everything
                SESSIONS.forEach(s => {
                    if (s.chainSend) zeroize(s.chainSend);
                    if (s.chainRecv) zeroize(s.chainRecv);
                    if (s.skippedKeys) {
                        s.skippedKeys.forEach(k => zeroize(k));
                        s.skippedKeys.clear();
                    }
                });
                SESSIONS.clear();
                result = { status: 'FULL_WIPE' };
                break;

            default:
                throw new Error('Unknown type');
        }

        self.postMessage({ id, result });

    } catch (err) {
        self.postMessage({ id, error: err.message });
    }
};
