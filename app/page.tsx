
"use client";
import { useState, useEffect, useRef } from 'react';
import { useSecureChat } from '@/hooks/useSecureChat';
import SetupSidebar from '@/components/SetupSidebar';
import MessageBubble from '@/components/MessageBubble';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';

export default function SecureChatPage() {
    const {
        isConnected,
        myPeerId,
        identityKey,
        messages,
        connect,
        establishSession,
        requestIdentity,
        sendMessage,
        deleteMessage,
        editMessage,
        error,
        verificationStatus,
        isLocked,
        lockSession,
        unlockSession,
        panicWipe,
        explicitReverify
    } = useSecureChat();

    // UI State
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [darkMode, setDarkMode] = useState(false);

    // Chat State
    const [targetId, setTargetId] = useState('');
    const [alias, setAlias] = useState<string | null>(null);
    const [inputText, setInputText] = useState('');

    // Rules
    const [readOnce, setReadOnce] = useState(false);
    const [expiresSeconds, setExpiresSeconds] = useState(0);

    const bottomRef = useRef<HTMLDivElement>(null);

    // Initialize Dark Mode
    useEffect(() => {
        const isDark = localStorage.getItem('theme') === 'dark' ||
            (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
        setDarkMode(isDark);
        if (isDark) document.documentElement.classList.add('dark');
    }, []);

    const toggleTheme = () => {
        const newMode = !darkMode;
        setDarkMode(newMode);
        localStorage.setItem('theme', newMode ? 'dark' : 'light');
        if (newMode) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
    };

    // QR Params & Key Exchange
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const peer = params.get('peer');
            const aliasParam = params.get('alias');
            const keyParam = params.get('key');

            if (peer) {
                setTargetId(peer);
                if (aliasParam) setAlias(aliasParam);
                setSidebarOpen(true);

                if (keyParam) {
                    try {
                        const peerKey = JSON.parse(atob(keyParam));
                        establishSession(peer, peerKey); // Establish Ratchet Session
                        connect(peer); // Connect WebSocket
                    } catch (e) {
                        // handle error
                    }
                } else {
                    connect(peer);
                    setTimeout(() => requestIdentity(peer), 1000);
                }
            }
        }
    }, [connect, establishSession, requestIdentity]);

    // Auto-scroll logic
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = () => {
        if (!inputText.trim()) return;
        sendMessage(targetId, inputText, {
            readOnce,
            expiresAfterSeconds: expiresSeconds > 0 ? expiresSeconds : 0
        });
        setInputText('');
    };

    if (isLocked) {
        return (
            <div className="fixed inset-0 z-[9999] bg-slate-900 flex flex-col items-center justify-center p-4">
                <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm w-full border border-slate-700">
                    <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mb-6">
                        <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Session Locked</h2>
                    <p className="text-slate-400 text-center mb-8 text-sm">
                        For your security, the session was locked due to inactivity or visibility change.
                    </p>
                    <button
                        onClick={unlockSession}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all active:scale-95"
                    >
                        Resume Session
                    </button>
                    <button
                        onClick={panicWipe}
                        className="mt-4 text-xs text-red-400 hover:text-red-300 underline"
                    >
                        Panic Wipe (Destroy All Data)
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex h-[100dvh] overflow-hidden bg-white dark:bg-black font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300`}>
            {/* Sidebar */}
            <SetupSidebar
                myPeerId={myPeerId}
                identityKey={identityKey}
                onConnect={(id) => {
                    setTargetId(id);
                    connect(id);
                    if (window.innerWidth < 768) setSidebarOpen(false);
                    setTimeout(() => requestIdentity(id), 1000);
                }}
                isConnected={isConnected}
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                onLock={lockSession}
                onPanic={panicWipe}
            />

            {/* Main Chat Area */}
            <main className="flex-1 flex flex-col relative w-full h-full">

                {/* Header */}
                <header className="h-16 flex items-center justify-between px-4 md:px-6 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 shrink-0 z-30">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="md:hidden p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                        </button>

                        <div className="flex flex-col">
                            <span className="font-bold text-sm md:text-base truncate max-w-[200px] flex items-center gap-2">
                                {alias ? alias : (targetId ? `Peer ${targetId.slice(0, 4)}...` : 'Secure Chat')}
                                {targetId && verificationStatus === 'verified' && (
                                    <span className="text-[10px] bg-green-500/10 text-green-600 border border-green-500/20 px-1 rounded" title="Identity Verified">VERIFIED</span>
                                )}
                                {targetId && verificationStatus === 'mismatch' && (
                                    <span className="text-[10px] bg-red-500/10 text-red-600 border border-red-500/20 px-1 rounded animate-pulse" title="Identity Mismatch">UNTRUSTED</span>
                                )}
                            </span>
                            <span className={`text-[10px] flex items-center gap-1.5 transition-colors ${isConnected ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
                                <span
                                    className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-slate-300'}`}
                                />
                                {isConnected ? (
                                    <span className="flex items-center gap-1">
                                        Encrypted <span className="text-[9px] border border-green-500/30 px-1 rounded bg-green-500/10">Double Ratchet</span>
                                    </span>
                                ) : 'Wait for connection'}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
                            {darkMode ? '☀️' : '🌙'}
                        </button>
                        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="hidden md:flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                            {sidebarOpen ? 'Hide' : 'Info'}
                        </button>
                    </div>
                </header>

                {/* Verification Mismatch Banner */}
                {verificationStatus === 'mismatch' && (
                    <div className="bg-red-600 text-white p-4 text-center z-50 animate-in slide-in-from-top-4 flex flex-col items-center gap-3 shadow-xl mx-4 mt-4 rounded-xl">
                        <div className="flex items-center gap-2 font-bold text-lg">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            SECURITY ALERT: IDENTITY CHANGED
                        </div>
                        <p className="text-sm max-w-lg opacity-90">
                            The peer&apos;s identity key has changed. This could mean they re-installed the app, OR someone is intercepting your connection (MITM Attack). Messages are blocked.
                        </p>
                        <div className="flex gap-4">
                            <button
                                onClick={panicWipe}
                                className="px-4 py-2 bg-white text-red-600 font-bold rounded-lg hover:bg-red-50"
                            >
                                Panic Wipe (Safe)
                            </button>
                            <button
                                onClick={() => explicitReverify(targetId)}
                                className="px-4 py-2 border border-white/50 hover:bg-white/10 text-white font-semibold rounded-lg"
                            >
                                Accept New Identity (Verify First!)
                            </button>
                        </div>
                    </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2 bg-slate-50 dark:bg-slate-950 scrollbar-hide">
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs rounded-lg text-center mx-auto max-w-sm mb-4">
                            {error}
                        </div>
                    )}

                    {messages.length === 0 && !error && verificationStatus !== 'mismatch' && (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                            <p>Secure Channel Ready.</p>
                        </div>
                    )}

                    {messages.map((msg) => (
                        <MessageBubble
                            key={msg.id}
                            msg={msg}
                            onDelete={(id) => deleteMessage(id, targetId)}
                            onEdit={(id, txt) => editMessage(id, txt, targetId)}
                        />
                    ))}
                    <div ref={bottomRef} className="h-1" />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0 z-30">
                    <div className="max-w-4xl mx-auto w-full">
                        <div className="flex items-center gap-4 mb-3 px-1 text-xs text-slate-500">
                            <label className={`flex items-center gap-2 cursor-pointer transition-colors select-none ${readOnce ? 'text-red-500 font-semibold' : 'hover:text-blue-500'}`}>
                                <input type="checkbox" checked={readOnce} onChange={(e) => setReadOnce(e.target.checked)} className="accent-red-500" />
                                <span>💥 Burn on read</span>
                            </label>
                            <div className="h-3 w-px bg-slate-200 dark:bg-slate-700"></div>
                            <div className={`flex items-center gap-2 transition-colors ${expiresSeconds > 0 ? 'text-orange-500 font-semibold' : 'hover:text-blue-500'}`}>
                                <span>⏳ Timer:</span>
                                <input type="number" value={expiresSeconds === 0 ? '' : expiresSeconds} onChange={(e) => setExpiresSeconds(Number(e.target.value))} className="w-8 bg-transparent border-b border-slate-300 dark:border-slate-700 focus:border-blue-500 outline-none text-center font-mono" min="0" placeholder="0" />
                                <span>s</span>
                            </div>
                        </div>

                        <div className={`flex items-end gap-2 bg-slate-50 dark:bg-slate-800 p-2 rounded-3xl border border-transparent focus-within:border-blue-500/30 focus-within:bg-white dark:focus-within:bg-black transition-all shadow-inner ${!isConnected || verificationStatus === 'mismatch' ? 'opacity-50 pointer-events-none' : ''}`}>
                            <textarea
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                                placeholder={verificationStatus === 'mismatch' ? "Sending Blocked - Identity Mismatch" : "Type a secure message..."}
                                className="flex-1 max-h-40 min-h-[44px] p-3 bg-transparent text-sm md:text-base outline-none resize-none placeholder:text-slate-400 text-slate-900 dark:text-slate-100 leading-relaxed"
                                rows={1}
                                style={{ height: 'auto', minHeight: '44px' }}
                                onInput={(e) => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }}
                                disabled={!isConnected || !targetId || verificationStatus === 'mismatch'}
                            />
                            <button
                                onClick={handleSend}
                                disabled={!isConnected || !targetId || !inputText.trim() || verificationStatus === 'mismatch'}
                                className="mb-1 mr-1 w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-blue-600 text-white disabled:opacity-50 disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-400 hover:bg-blue-700 active:scale-95 transition-all shadow-md"
                            >
                                <svg className="w-5 h-5 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
