
import Link from 'next/link';

export default function SecurityModelPage() {
    return (
        <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans p-6 md:p-12">
            <div className="max-w-4xl mx-auto space-y-12">
                <header className="border-b border-slate-200 dark:border-slate-800 pb-8">
                    <h1 className="text-4xl font-extrabold tracking-tight mb-4 text-slate-900 dark:text-white">Security Architecture & Threat Model</h1>
                    <p className="text-lg text-slate-600 dark:text-slate-400">
                        Transparency Report & Technical Audit Documentation
                    </p>
                    <p className="text-sm text-slate-500 mt-2">Last Updated: V3.1 Hardening (Dec 2025)</p>
                </header>

                <section className="space-y-6">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">1. Honest Comparisons</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-800">
                                    <th className="py-4 pr-8 font-semibold">Feature</th>
                                    <th className="py-4 pr-8 text-blue-600">SecureChat</th>
                                    <th className="py-4 pr-8 text-green-600">WhatsApp</th>
                                    <th className="py-4 pr-8 text-sky-500">Telegram</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                                <tr>
                                    <td className="py-3 font-medium">End-to-End Encryption</td>
                                    <td className="py-3">Always On (Double Ratchet)</td>
                                    <td className="py-3">Always On</td>
                                    <td className="py-3 text-red-500">Optional (Secret Chats only)</td>
                                </tr>
                                <tr>
                                    <td className="py-3 font-medium">Metadata</td>
                                    <td className="py-3">Minimal (Ephemeral IDs)</td>
                                    <td className="py-3 text-red-500">High (Social Graph, Location)</td>
                                    <td className="py-3 text-red-500">High (Server Cloud Storage)</td>
                                </tr>
                                <tr>
                                    <td className="py-3 font-medium">Source Code</td>
                                    <td className="py-3">100% Open (Client & Relay)</td>
                                    <td className="py-3 text-red-500">Closed (Client & Server)</td>
                                    <td className="py-3 text-yellow-500">Client Open, Server Closed</td>
                                </tr>
                                <tr>
                                    <td className="py-3 font-medium">Cryptography</td>
                                    <td className="py-3">Web Crypto API (Auditable)</td>
                                    <td className="py-3">LibSignal (Verified but Opaque Binary)</td>
                                    <td className="py-3 text-yellow-500">MTProto (Custom)</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="space-y-6">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">2. Explicit Attacker Models</h2>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                            <h3 className="font-bold text-lg mb-2">Network Adversary (Global Passive)</h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                An attacker recording all internet traffic (ISP, Nation State).
                                <br /><br />
                                <strong>Defense:</strong> TLS 1.3 (Transport) + AES-GCM (Payload). Traffic Analysis resistance via packet padding and randomized jitter makes determining message content or typing patterns statistically difficult.
                            </p>
                        </div>
                        <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                            <h3 className="font-bold text-lg mb-2">Malicious Server (Active)</h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                The Relay Server operator attempts to read or modify messages.
                                <br /><br />
                                <strong>Defense:</strong> The server holds no keys. Zero-Knowledge architecture. Message modifications cause decryption failures (Auth Tag mismatch) and are rejected.
                            </p>
                        </div>
                        <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                            <h3 className="font-bold text-lg mb-2">Endpoint Seizure (Forensic)</h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                Physical access to the unlocked device (Evil Maid).
                                <br /><br />
                                <strong>Mitigation:</strong> Auto-Session Lock on inactivity (5 min) or visibility loss. &quot;Panic Wipe&quot; capability destroys all keys in memory and storage instantaneously.
                            </p>
                        </div>
                        <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                            <h3 className="font-bold text-lg mb-2">Supply Chain Attack</h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                Malicious code injected into dependencies.
                                <br /><br />
                                <strong>Defense:</strong> Strict CSP denies external scripts. No third-party crypto libraries used. Core crypto isolated in a Web Worker.
                            </p>
                        </div>
                    </div>
                </section>

                <section className="space-y-6">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">3. Security Guarantees & Limitations</h2>
                    <div className="space-y-4">
                        <div className="flex gap-4">
                            <div className="shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600">✓</div>
                            <div>
                                <h4 className="font-bold">Confidentiality & Integrity</h4>
                                <p className="text-sm text-slate-600 dark:text-slate-400">Authenticated Encryption (AES-GCM-256) ensures only the intended recipient can read messages and detect tampering.</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600">✓</div>
                            <div>
                                <h4 className="font-bold">Replay Protection</h4>
                                <p className="text-sm text-slate-600 dark:text-slate-400">Strict nonce enforcement and skipped message tracking rejects replayed messages.</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="shrink-0 w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-yellow-600">⚠️</div>
                            <div>
                                <h4 className="font-bold">Metadata Leakage</h4>
                                <p className="text-sm text-slate-600 dark:text-slate-400">The relay server knows your IP address. Use Tor or VPN for anonymity.</p>
                            </div>
                        </div>

                        {/* Explicit Non-Goals */}
                        <div className="border-t border-slate-200 dark:border-slate-800 pt-4 mt-6">
                            <h4 className="font-bold text-red-600 mb-2">PROHIBITED / OUT OF SCOPE (Non-Goals)</h4>
                            <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1">
                                <li><strong>Device Malware:</strong> If your OS is compromised (e.g. Pegasus, Keyloggers), this app cannot protect you.</li>
                                <li><strong>Browser Vulnerabilities:</strong> We assume the browser&apos;s sandbox and Web Crypto implementation are secure.</li>
                                <li><strong>Push Notifications:</strong> Intentionally excluded to prevent leaking metadata to Apple/Google servers.</li>
                            </ul>
                        </div>
                    </div>
                </section>

                <section className="space-y-4">
                    <h2 className="text-xl font-bold border-b border-slate-200 dark:border-slate-800 pb-2">V3 Hardening Specs</h2>
                    <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg font-mono text-xs overflow-x-auto border border-slate-200 dark:border-slate-800">
                        <p><strong>Crypto Isolation:</strong> Dedicated Web Worker (Memory Zeroization)</p>
                        <p><strong>Session Security:</strong> Auto-Lock (5min timeout), Panic Wipe (Database+Memory)</p>
                        <p><strong>Transport:</strong> WSS Enforced, HSTS, strict CSP</p>
                        <p><strong>Identity:</strong> TOFU with strict Mismatch Detection (Anti-MITM)</p>
                    </div>
                </section>

                <footer className="pt-8 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-sm text-slate-500">
                    <div>
                        <a href="/security/events" className="text-blue-600 hover:underline font-bold">View Local Security Log</a>
                    </div>
                    <div>
                        <Link href="/" className="hover:underline">Back to Chat</Link>
                    </div>
                </footer>
            </div>
        </div>
    );
}
