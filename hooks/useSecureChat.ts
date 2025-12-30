
import { useState, useEffect, useRef, useCallback } from 'react';
import { securityDB } from '../lib/storage/db';

// --- Types ---
export interface Message {
    id: string;
    from: string;
    text: string;
    timestamp: number;
    isOwn: boolean;
    isEdited?: boolean;
    rules?: {
        readOnce: boolean;
        expiresAfterSeconds: number;
    };
    expiresAt?: number;
}

interface ChatState {
    isConnected: boolean;
    myPeerId: string | null;
    messages: Message[];
    error: string | null;
    verificationStatus: 'new' | 'verified' | 'mismatch';
    isLocked: boolean;
    unreadCount: number;
}

// --- Audit Logger ---
const logSecurityEvent = (type: string, severity: 'INFO' | 'WARNING' | 'CRITICAL', message: string, meta?: any) => {
    securityDB.put('security_events', { type, severity, message, meta, timestamp: Date.now() }).catch(console.error);
};

// --- Worker Client ---
class CryptoWorkerClient {
    private worker: Worker;
    private callbacks = new Map<string, { resolve: Function, reject: Function }>();

    constructor() {
        this.worker = new Worker('/worker.js');
        this.worker.onmessage = (e) => {
            const { id, result, error } = e.data;
            if (this.callbacks.has(id)) {
                const { resolve, reject } = this.callbacks.get(id)!;
                if (error) reject(new Error(error));
                else resolve(result);
                this.callbacks.delete(id);
            }
        };
    }

    private async post(type: string, payload: any): Promise<any> {
        const id = crypto.randomUUID();
        return new Promise((resolve, reject) => {
            this.callbacks.set(id, { resolve, reject });
            this.worker.postMessage({ id, type, payload });
        });
    }

    async initIdentity(persisted?: { publicKey: JsonWebKey, privateKey: JsonWebKey }) {
        if (persisted) return this.post('IMPORT_IDENTITY', persisted);
        return this.post('INIT_IDENTITY', {});
    }

    async initSession(peerId: string, peerPublicKey: JsonWebKey, isInitiator: boolean) {
        return this.post('INIT_SESSION', { peerId, peerPublicKey, isInitiator });
    }

    async encrypt(peerId: string, text: string) {
        return this.post('ENCRYPT', { peerId, text });
    }

    async decrypt(peerId: string, ciphertext: number[], iv: number[], header: any) {
        return this.post('DECRYPT', { peerId, ciphertext, iv, header });
    }

    async clearState() {
        return this.post('CLEAR_STATE', {});
    }
}

// --- Hook ---
export const useSecureChat = () => {
    const [state, setState] = useState<ChatState>({
        isConnected: false,
        myPeerId: null,
        messages: [],
        error: null,
        verificationStatus: 'verified',
        isLocked: false,
        unreadCount: 0
    });

    const wsRef = useRef<WebSocket | null>(null);
    const workerRef = useRef<CryptoWorkerClient | null>(null);
    const processedMessageIds = useRef<Set<string>>(new Set());
    const myIdentityKey = useRef<JsonWebKey | null>(null);
    const peerIdentities = useRef<Map<string, JsonWebKey>>(new Map());
    const pendingHandshakes = useRef<Map<string, { resolve: (key: JsonWebKey) => void, reject: (err: Error) => void }>>(new Map());

    // Inactivity Timer
    const idleTimer = useRef<NodeJS.Timeout | null>(null);

    // --- Actions ---
    const lockSession = useCallback(() => {
        // Clear messages from UI state (In-Memory Wipe)
        setState(prev => ({ ...prev, isLocked: true, messages: [] }));
    }, []);

    const unlockSession = useCallback(() => {
        setState(prev => ({ ...prev, isLocked: false }));
    }, []);

    const panicWipe = useCallback(async () => {
        // MAX SECURITY: Wipe Everything
        try {
            await securityDB.clear('identity');
            await securityDB.clear('sessions'); // if used
            await securityDB.clear('ratchet'); // (if any)
            await securityDB.clear('trusted_peers');
            await securityDB.clear('security_events');

            if (workerRef.current) {
                await workerRef.current.clearState();
            }
        } catch (e) { console.error("Wipe failed", e); }

        window.location.reload();
    }, []);

    const resetIdleTimer = useCallback(() => {
        if (idleTimer.current) clearTimeout(idleTimer.current);
        idleTimer.current = setTimeout(() => {
            lockSession();
        }, 5 * 60 * 1000); // 5 Minutes
    }, [lockSession]);

    // --- Inactivity & Visibility Monitoring ---
    useEffect(() => {
        const handleVis = () => {
            // Lock immediately on hide (Mobile/Tab switch)
            if (document.hidden) lockSession();
        };

        const handleInput = () => resetIdleTimer();

        document.addEventListener('visibilitychange', handleVis);
        window.addEventListener('mousemove', handleInput);
        window.addEventListener('keydown', handleInput);
        window.addEventListener('touchstart', handleInput);

        resetIdleTimer();

        return () => {
            document.removeEventListener('visibilitychange', handleVis);
            window.removeEventListener('mousemove', handleInput);
            window.removeEventListener('keydown', handleInput);
            window.removeEventListener('touchstart', handleInput);
            if (idleTimer.current) clearTimeout(idleTimer.current);
        };
    }, [lockSession, resetIdleTimer]);

    const requestIdentity = useCallback((targetId: string) => {
        if (!wsRef.current || !state.myPeerId) return;
        wsRef.current.send(JSON.stringify({
            type: 'request_identity',
            from: state.myPeerId,
            to: targetId
        }));
    }, [state.myPeerId]);

    const deleteMessage = useCallback(async (id: string, targetPeerId?: string) => {
        // Local Delete
        setState(prev => ({
            ...prev,
            messages: prev.messages.filter(m => m.id !== id)
        }));

        // Remote Delete (Recall)
        if (targetPeerId && workerRef.current && wsRef.current && state.myPeerId) {
            try {
                if (state.verificationStatus === 'mismatch') return; // Block if compromised
                const wrappedBuffer = JSON.stringify({ type: 'delete', id });
                const result = await workerRef.current.encrypt(targetPeerId, wrappedBuffer);

                const payloadData = {
                    type: 'message',
                    to: targetPeerId,
                    from: state.myPeerId,
                    encryptedData: { cipher: result.ciphertext, iv: result.iv },
                    header: { count: result.header.count, identityKey: myIdentityKey.current },
                    timestamp: Date.now()
                };
                wsRef.current.send(JSON.stringify(payloadData));
            } catch (e) {
                console.error("Failed to propagate delete", e);
            }
        }
    }, [state.myPeerId, state.verificationStatus]);

    const editMessage = useCallback(async (id: string, newText: string, targetPeerId?: string) => {
        setState(prev => ({
            ...prev,
            messages: prev.messages.map(m => m.id === id ? { ...m, text: newText, isEdited: true } : m)
        }));

        if (targetPeerId && workerRef.current && wsRef.current && state.myPeerId) {
            try {
                if (state.verificationStatus === 'mismatch') return;
                const wrappedBuffer = JSON.stringify({ type: 'edit', id, content: newText });
                const result = await workerRef.current.encrypt(targetPeerId, wrappedBuffer);

                const payloadData = {
                    type: 'message',
                    to: targetPeerId,
                    from: state.myPeerId,
                    encryptedData: { cipher: result.ciphertext, iv: result.iv },
                    header: { count: result.header.count, identityKey: myIdentityKey.current },
                    timestamp: Date.now()
                };
                wsRef.current.send(JSON.stringify(payloadData));
            } catch (e) {
                console.error("Failed to propagate edit", e);
            }
        }
    }, [state.myPeerId, state.verificationStatus]);

    // --- Init ---
    useEffect(() => {
        const init = async () => {
            try {
                // Ensure Worker Uncached
                workerRef.current = new CryptoWorkerClient();

                const stored = await securityDB.get('identity', 'me');
                let pubKey: JsonWebKey;

                if (stored) {
                    await workerRef.current.initIdentity(stored);
                    pubKey = stored.publicKey;
                } else {
                    const res = await workerRef.current.initIdentity();
                    pubKey = res.publicKey;
                    await securityDB.put('identity', { id: 'me', ...res });
                    logSecurityEvent('IDENTITY_GEN', 'INFO', 'New Identity Key Generated');
                }

                myIdentityKey.current = pubKey;

                // Load Trusted Peers
                const trusted = await securityDB.getAll('trusted_peers');
                if (trusted) {
                    trusted.forEach(t => peerIdentities.current.set(t.peerId, t.key));
                }

                const array = new Uint8Array(8);
                window.crypto.getRandomValues(array);
                const peerId = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');

                setState(prev => ({ ...prev, myPeerId: peerId }));

            } catch (err) {
                console.error("Crypto Init Failed", err);
                logSecurityEvent('SYSTEM_ERROR', 'CRITICAL', 'Crypto Init Failed', { error: String(err) });
                setState(prev => ({ ...prev, error: "Security subsystem failed." }));
            }
        };
        init();
    }, []);

    // --- Connect ---
    const connect = useCallback((targetPeerId: string) => {
        if (!state.myPeerId) return;
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        // [SECURITY] Enforce WSS on HTTPS
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        if (window.location.protocol === 'https:' && protocol !== 'wss:') {
            throw new Error("Mixed Content Security Violation: WSS required");
        }

        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || `${protocol}//${window.location.hostname}:${process.env.WS_PORT || 3001}`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            ws.send(JSON.stringify({ type: 'register', peerId: state.myPeerId }));
        };

        ws.onmessage = async (event) => {
            try {
                const data = JSON.parse(event.data);

                // Handle Notification (Local Badge)
                if (document.hidden && data.type === 'message') {
                    if (navigator.setAppBadge) navigator.setAppBadge(1).catch(() => { });
                    setState(prev => ({ ...prev, unreadCount: prev.unreadCount + 1 }));
                }

                if (data.type === 'registered') {
                    setState(prev => ({ ...prev, isConnected: true, error: null }));
                }
                else if (data.type === 'message') {
                    const msgId = `${data.from}-${data.timestamp}`;
                    if (processedMessageIds.current.has(msgId)) {
                        logSecurityEvent('REPLAY_ATTEMPT', 'WARNING', 'Duplicate message ID blocked', { from: data.from });
                        return;
                    }
                    processedMessageIds.current.add(msgId);

                    try {
                        const header = data.header;
                        const existingKey = peerIdentities.current.get(data.from);

                        if (header && header.identityKey) {
                            // [SECURITY] Strict Identity Pinning (TOFU)
                            if (existingKey) {
                                // Compare keys (Simple Check: Serialize)
                                const k1 = JSON.stringify(existingKey);
                                const k2 = JSON.stringify(header.identityKey);
                                if (k1 !== k2) {
                                    // CRITICAL: MITM / Key Change Detected
                                    logSecurityEvent('IDENTITY_MISMATCH', 'CRITICAL', 'Identity Key Changed for Peer', { peer: data.from });
                                    setState(prev => ({
                                        ...prev,
                                        verificationStatus: 'mismatch',
                                        error: "SECURITY ALERT: Peer Identity Changed! Possible MITM.",
                                        // Do not process message
                                    }));
                                    return; // FAIL CLOSED
                                }
                            } else {
                                // First time trust
                                await workerRef.current?.initSession(data.from, header.identityKey, false);
                                peerIdentities.current.set(data.from, header.identityKey);
                                await securityDB.put('trusted_peers', { peerId: data.from, key: header.identityKey });
                            }
                        } else if (!existingKey) {
                            throw new Error("Missing Identity Key for new session");
                        }

                        const ciphertext = data.encryptedData.cipher || data.encryptedData;
                        const iv = data.encryptedData.iv;

                        const rawText = await workerRef.current?.decrypt(data.from, ciphertext, iv, data.header);

                        let content = rawText;
                        let isEdit = false;
                        let editTargetId = null;
                        let isDelete = false;
                        let deleteTargetId = null;

                        try {
                            const payload = JSON.parse(rawText);
                            if (payload?.type === 'text') content = payload.content;
                            else if (payload?.type === 'edit') {
                                isEdit = true;
                                editTargetId = payload.id;
                                content = payload.content;
                            } else if (payload?.type === 'delete') {
                                isDelete = true;
                                deleteTargetId = payload.id;
                            }
                        } catch (e) { }

                        if (isDelete && deleteTargetId) {
                            setState(prev => ({
                                ...prev,
                                messages: prev.messages.filter(m => m.id !== deleteTargetId)
                            }));
                            return;
                        }

                        if (isEdit && editTargetId) {
                            setState(prev => ({
                                ...prev,
                                messages: prev.messages.map(m =>
                                    m.id === editTargetId ? { ...m, text: content, isEdited: true } : m
                                )
                            }));
                            return;
                        }

                        const newMessage: Message = {
                            id: msgId,
                            from: data.from,
                            text: content,
                            timestamp: data.timestamp,
                            isOwn: false,
                            rules: data.rules,
                            expiresAt: data.rules?.expiresAfterSeconds ? Date.now() + (data.rules.expiresAfterSeconds * 1000) : undefined
                        };

                        setState(prev => ({ ...prev, messages: [...prev.messages, newMessage] }));

                        if (data.rules?.readOnce) {
                            setTimeout(() => deleteMessage(msgId), 2000);
                        }
                    } catch (e) {
                        console.error("Decryption failed", e);
                        logSecurityEvent('DECRYPT_FAILURE', 'CRITICAL', 'Message Decryption Failed', { from: data.from, error: String(e) });
                    }
                }
                else if (data.type === 'request_identity') {
                    if (wsRef.current && myIdentityKey.current) {
                        wsRef.current.send(JSON.stringify({
                            type: 'identity_response',
                            to: data.from,
                            from: state.myPeerId,
                            publicKey: myIdentityKey.current
                        }));
                    }
                }
                else if (data.type === 'identity_response') {
                    if (data.publicKey) {
                        const existing = peerIdentities.current.get(data.from);

                        if (existing) {
                            if (JSON.stringify(existing) !== JSON.stringify(data.publicKey)) {
                                setState(prev => ({ ...prev, verificationStatus: 'mismatch', error: "Identity Key Mismatch during Handshake" }));
                                return;
                            }
                        }

                        await workerRef.current?.initSession(data.from, data.publicKey, true);
                        peerIdentities.current.set(data.from, data.publicKey);
                        await securityDB.put('trusted_peers', { peerId: data.from, key: data.publicKey });
                        setState(prev => ({ ...prev, verificationStatus: 'verified' }));

                        if (pendingHandshakes.current.has(data.from)) {
                            pendingHandshakes.current.get(data.from)!.resolve(data.publicKey);
                            pendingHandshakes.current.delete(data.from);
                        }
                    }
                }
                else if (data.type === 'error') {
                    if (data.message === 'Target peer not connected') {
                        pendingHandshakes.current.forEach(p => p.reject(new Error("Peer not connected")));
                        pendingHandshakes.current.clear();
                    }
                    setState(prev => ({ ...prev, error: data.message }));
                }
            } catch (e) {
                console.error(e);
            }
        };

        ws.onclose = () => setState(prev => ({ ...prev, isConnected: false }));
        // Do NOT log error to UI for generic connection issues to avoid noise, unless critical
    }, [state.myPeerId, requestIdentity, deleteMessage]);

    const establishSession = async (peerId: string, publicKey: JsonWebKey) => {
        if (!workerRef.current) return;
        await workerRef.current.initSession(peerId, publicKey, true);
        peerIdentities.current.set(peerId, publicKey);
        await securityDB.put('trusted_peers', { peerId, key: publicKey });
    };

    const sendMessage = async (targetId: string, text: string, rules: any) => {
        if (!workerRef.current || !wsRef.current) return;
        if (state.verificationStatus === 'mismatch') {
            throw new Error("Cannot send: Peer Identity Mismatch");
        }

        try {
            // JIT Handshake
            if (!peerIdentities.current.has(targetId)) {
                requestIdentity(targetId);
                try {
                    await new Promise<JsonWebKey>((resolve, reject) => {
                        const timeout = setTimeout(() => {
                            pendingHandshakes.current.delete(targetId);
                            reject(new Error("Timeout waiting for Peer Key"));
                        }, 5000);

                        pendingHandshakes.current.set(targetId, {
                            resolve: (k) => { clearTimeout(timeout); resolve(k); },
                            reject: (e) => { clearTimeout(timeout); reject(e); }
                        });
                    });
                } catch (e: any) {
                    logSecurityEvent('HANDSHAKE_FAILURE', 'WARNING', 'Failed to handshake', { targetId, error: e.message });
                    setState(prev => ({ ...prev, error: e.message || "Peer unreachable." }));
                    return;
                }
            }

            const jitter = Math.floor(Math.random() * 300);
            await new Promise(r => setTimeout(r, jitter)); // Metadata protection

            const wrappedContent = JSON.stringify({ type: 'text', content: text });
            const result = await workerRef.current.encrypt(targetId, wrappedContent);

            const payloadData = {
                type: 'message',
                to: targetId,
                from: state.myPeerId,
                encryptedData: { cipher: result.ciphertext, iv: result.iv },
                header: { count: result.header.count, identityKey: myIdentityKey.current },
                rules,
                timestamp: Date.now()
            };

            wsRef.current.send(JSON.stringify(payloadData));

            const consistentId = `${state.myPeerId}-${payloadData.timestamp}`;
            const newMessage: Message = {
                id: consistentId,
                from: state.myPeerId!,
                text,
                timestamp: payloadData.timestamp,
                isOwn: true,
                rules,
                isEdited: false,
                expiresAt: rules.expiresAfterSeconds ? Date.now() + (rules.expiresAfterSeconds * 1000) : undefined
            };

            setState(prev => ({
                ...prev,
                messages: [...prev.messages, newMessage],
                // Reset idle on send
            }));
            resetIdleTimer();

        } catch (e) {
            console.error(e);
            logSecurityEvent('ENCRYPT_FAILURE', 'CRITICAL', 'Encryption Failed', { error: String(e) });
            setState(prev => ({ ...prev, error: "Encryption Error" }));
        }
    };

    const explicitReverify = useCallback(async (targetId: string) => {
        // [UX] User accepts new identity.
        // Wipe old session key for this peer to force fresh start.
        // NOTE: This is dangerous but user-commanded.
        peerIdentities.current.delete(targetId);
        setState(prev => ({ ...prev, verificationStatus: 'verified', error: null }));
        requestIdentity(targetId);
    }, [requestIdentity]);

    // Timer cleanup
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            setState(prev => {
                const hasExpired = prev.messages.some(msg => msg.expiresAt && msg.expiresAt <= now);
                if (hasExpired) {
                    return { ...prev, messages: prev.messages.filter(msg => !msg.expiresAt || msg.expiresAt > now) };
                }
                return prev;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    return {
        ...state,
        identityKey: myIdentityKey.current,
        connect,
        requestIdentity,
        establishSession,
        sendMessage,
        deleteMessage,
        editMessage,
        lockSession,
        unlockSession,
        panicWipe,
        explicitReverify
    };
};
