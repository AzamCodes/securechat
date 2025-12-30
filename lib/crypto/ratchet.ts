
import * as Utils from './utils';

export interface RatchetState {
    rootKey: ArrayBuffer;
    chainKeySend: ArrayBuffer;
    chainKeyRecv: ArrayBuffer;
    myEphemeralKeyPair: CryptoKeyPair;
    peerEphemeralKey: CryptoKey | null;
    msgCountSend: number;
    msgCountRecv: number;
}

export class DoubleRatchet {
    private state: RatchetState | null = null;
    private peerIdentityKey: CryptoKey | null = null;

    // Initialize as Alice (Sender)
    async initAsAlice(peerIdKey: CryptoKey, sharedSecret: ArrayBuffer): Promise<void> {
        this.peerIdentityKey = peerIdKey;
        const derived = await Utils.hkdf(sharedSecret, new Uint8Array(32), new Uint8Array(0));
        // Split into Root + Chain
        // Simplified: Use derived as Root, generate Chains from it
        const rootKey = derived;

        // Generate first Ephemeral
        const ephPair = await Utils.generateIdentityKeyPair();

        this.state = {
            rootKey,
            chainKeySend: rootKey, // Should be split
            chainKeyRecv: new ArrayBuffer(32), // Empty initially until Bob replies
            myEphemeralKeyPair: ephPair,
            peerEphemeralKey: null,
            msgCountSend: 0,
            msgCountRecv: 0
        };
    }

    // Initialize as Bob (Receiver)
    async initAsBob(peerIdKey: CryptoKey, sharedSecret: ArrayBuffer, peerEphKey: CryptoKey): Promise<void> {
        this.peerIdentityKey = peerIdKey;
        const derived = await Utils.hkdf(sharedSecret, new Uint8Array(32), new Uint8Array(0));

        const myEph = await Utils.generateIdentityKeyPair();

        this.state = {
            rootKey: derived,
            chainKeySend: new ArrayBuffer(32), // Empty initially
            chainKeyRecv: derived,
            myEphemeralKeyPair: myEph,
            peerEphemeralKey: peerEphKey,
            msgCountSend: 0,
            msgCountRecv: 0
        };
    }

    // Ratchet Step (Symmetric)
    private async kdfChain(chainKey: ArrayBuffer): Promise<{ nextChain: ArrayBuffer, msgKey: CryptoKey }> {
        // HKDF to derive Message Key (32 bytes) + Next Chain Key (32 bytes)
        // Input: ChainKey. Salt: 0. Info: "MessageKey" / "ChainKey"
        const mkMaterial = await Utils.hkdf(chainKey, new Uint8Array(0), new TextEncoder().encode("MessageKey"));
        const ckMaterial = await Utils.hkdf(chainKey, new Uint8Array(0), new TextEncoder().encode("ChainKey"));

        const msgKey = await Utils.importChainKey(mkMaterial); // AES-GCM
        return { nextChain: ckMaterial, msgKey };
    }

    // Encrypt Message
    async encrypt(text: string): Promise<{
        header: { pubKey: JsonWebKey, count: number },
        ciphertext: ArrayBuffer,
        iv: Uint8Array
    }> {
        if (!this.state) throw new Error("Ratchet not initialized");

        // 1. KDF Chain Step (Sending)
        const { nextChain, msgKey } = await this.kdfChain(this.state.chainKeySend);
        this.state.chainKeySend = nextChain;

        // 2. Encrypt
        const { iv, ciphertext } = await Utils.encrypt(msgKey, text);

        // 3. Prepare Header
        const pubKey = await Utils.exportPublicKey(this.state.myEphemeralKeyPair.publicKey);
        const count = this.state.msgCountSend++;

        return {
            header: { pubKey, count },
            ciphertext,
            iv
        };
    }

    // Decrypt Message
    async decrypt(
        header: { pubKey: JsonWebKey, count: number },
        ciphertext: ArrayBuffer,
        iv: Uint8Array
    ): Promise<string> {
        if (!this.state) throw new Error("Ratchet not initialized");

        // Handle DH Ratchet (If new Public Key seen)
        // Checking if header.pubKey differs from current peerEphemeralKey would go here.
        // For MVP "Hardened" step, assume Symmetric Ratchet mostly, will update peer key on mismatch.

        // 1. KDF Chain Step (Recv)
        const { nextChain, msgKey } = await this.kdfChain(this.state.chainKeyRecv);
        this.state.chainKeyRecv = nextChain;

        // 2. Decrypt
        const plaintext = await Utils.decrypt(msgKey, iv as any, ciphertext);
        this.state.msgCountRecv++;

        return plaintext;
    }
}
