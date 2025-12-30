
// Web Crypto API Wrapper for High-Assurance Messaging

export async function generateIdentityKeyPair(): Promise<CryptoKeyPair> {
    return window.crypto.subtle.generateKey(
        {
            name: 'ECDH',
            namedCurve: 'P-256',
        },
        false, // Private key matches non-extractable reqs? Actually need to store it. 
        // IndexedDB can store non-extractable keys.
        ['deriveKey', 'deriveBits']
    );
}

export async function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
    return window.crypto.subtle.importKey(
        'jwk',
        jwk,
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        []
    );
}

export async function exportPublicKey(key: CryptoKey): Promise<JsonWebKey> {
    return window.crypto.subtle.exportKey('jwk', key);
}

export async function deriveMasterSecret(
    privateKey: CryptoKey,
    publicKey: CryptoKey
): Promise<ArrayBuffer> {
    return window.crypto.subtle.deriveBits(
        {
            name: 'ECDH',
            public: publicKey,
        },
        privateKey,
        256
    );
}

export async function hkdf(
    inputKeyMaterial: BufferSource,
    salt: BufferSource,
    info: BufferSource
): Promise<ArrayBuffer> {
    // Web Crypto HKDF
    const key = await window.crypto.subtle.importKey(
        'raw',
        inputKeyMaterial,
        { name: 'HKDF' },
        false,
        ['deriveBits']
    );

    return window.crypto.subtle.deriveBits(
        {
            name: 'HKDF',
            hash: 'SHA-256',
            salt: salt,
            info: info,
        },
        key,
        256 * 2 // Derive enough for Root + Chain (Example)
    );
}

export async function encrypt(
    key: CryptoKey,
    plaintext: string
): Promise<{ iv: Uint8Array; ciphertext: ArrayBuffer }> {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const ciphertext = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoded
    );
    return { iv, ciphertext };
}

export async function decrypt(
    key: CryptoKey,
    iv: BufferSource,
    ciphertext: BufferSource
): Promise<string> {
    const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ciphertext
    );
    return new TextDecoder().decode(decrypted);
}

export async function importChainKey(raw: BufferSource): Promise<CryptoKey> {
    return window.crypto.subtle.importKey(
        'raw',
        raw,
        { name: 'AES-GCM', length: 256 },
        true, // Extractable for ratchet
        ['encrypt', 'decrypt']
    );
}
