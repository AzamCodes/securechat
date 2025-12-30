
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

interface SetupSidebarProps {
    myPeerId: string | null;
    identityKey?: JsonWebKey | null;
    onConnect: (peerId: string) => void;
    isConnected: boolean;
    isOpen: boolean;
    onClose: () => void;
    onLock?: () => void;
    onPanic?: () => void;
    className?: string;
}

export default function SetupSidebar({ myPeerId, identityKey, onConnect, isConnected, isOpen, onClose, onLock, onPanic, className = '' }: SetupSidebarProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [showFullId, setShowFullId] = useState(false);
    const [myAlias, setMyAlias] = useState('');

    // Generate QR Code with Deep Link
    useEffect(() => {
        if (myPeerId && canvasRef.current) {
            const baseUrl = window.location.origin;
            const aliasPart = myAlias ? `&alias=${encodeURIComponent(myAlias)}` : '';
            const keyPart = identityKey ? `&key=${encodeURIComponent(btoa(JSON.stringify(identityKey)))}` : '';
            const qrValue = `${baseUrl}/?peer=${myPeerId}${aliasPart}${keyPart}`;

            QRCode.toCanvas(canvasRef.current, qrValue, {
                width: 200,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            }, (err) => {
                if (err) console.error(err);
            });
        }
    }, [myPeerId, isOpen, myAlias, identityKey]);

    const handleCopy = () => {
        if (myPeerId) {
            navigator.clipboard.writeText(myPeerId);
        }
    };

    const fingerprint = myPeerId ? `${myPeerId.slice(0, 4)}••••${myPeerId.slice(-4)}` : 'Generating...';

    return (
        <>
            {/* Mobile Overlay */}
            <div
                className={`fixed inset-0 bg-slate-900/60 z-40 md:hidden backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
            />

            <aside className={`
                fixed md:static inset-y-0 left-0 z-50 
                w-[85vw] md:w-80 max-w-[360px] 
                bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800
                transform transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none
                flex flex-col
                ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                ${className}
            `}>
                {/* Header */}
                <div className="p-6 md:p-8 pb-0 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                            Secure Chat
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Double Ratchet</span>
                            <p className="text-xs text-slate-500">Active</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="md:hidden text-slate-400 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 scrollbar-hide">

                    {/* Identity Section */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-end">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Your Identity</label>
                            <button
                                onClick={() => setShowFullId(!showFullId)}
                                className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                            >
                                {showFullId ? 'Hide Details' : 'Show Details'}
                            </button>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
                            <input
                                type="text"
                                placeholder="Set Display Name (Optional)"
                                value={myAlias}
                                onChange={(e) => setMyAlias(e.target.value)}
                                className="w-full bg-transparent border-b border-slate-200 dark:border-slate-700 pb-2 text-sm font-medium focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-400 text-slate-900 dark:text-slate-100"
                            />

                            <div className="flex justify-center bg-white p-2 rounded-xl border border-slate-100 shadow-sm aspect-square relative group">
                                <canvas ref={canvasRef} className="w-full h-full object-contain" />
                                {!identityKey && (
                                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center text-xs text-slate-500">
                                        Generating Keys...
                                    </div>
                                )}
                            </div>

                            <div
                                onClick={handleCopy}
                                className="relative group cursor-pointer text-center"
                            >
                                <p className="font-mono text-sm text-slate-600 dark:text-slate-300 bg-slate-200/50 dark:bg-slate-800 py-2 px-3 rounded-lg overflow-hidden text-ellipsis">
                                    {showFullId ? myPeerId : fingerprint}
                                </p>
                                <span className="absolute inset-0 flex items-center justify-center bg-slate-900/90 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                    Tap to Copy ID
                                </span>
                            </div>
                        </div>
                        <p className="text-[10px] text-center text-slate-400 leading-relaxed">
                            Scan to share Identity Key + Peer ID.
                        </p>
                    </div>

                    {/* Connection Section */}
                    <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Connect to Peer</label>
                        <div className="space-y-3">
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Paste Peer ID"
                                className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-slate-900 dark:text-slate-100 text-sm font-mono"
                            />
                            <button
                                onClick={() => inputRef.current?.value && onConnect(inputRef.current.value)}
                                disabled={isConnected}
                                className={`w-full py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all transform active:scale-[0.98] ${isConnected
                                    ? 'bg-green-500/10 text-green-600 dark:text-green-400 cursor-default border border-green-500/20'
                                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/25'
                                    }`}
                            >
                                {isConnected ? '✓ Secure Connection Active' : 'Connect'}
                            </button>
                        </div>
                    </div>

                    {/* Advanced Security */}
                    <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Security Control</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={onLock} className="flex items-center justify-center gap-2 p-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300 text-xs font-bold transition-colors">
                                <span>🔒</span> Lock
                            </button>
                            <button onClick={onPanic} className="flex items-center justify-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl text-red-600 dark:text-red-400 text-xs font-bold transition-colors">
                                <span>⚠️</span> Panic Wipe
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 dark:border-slate-800 text-center">
                    <div className="flex justify-center items-center gap-2 text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
                        <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-400'}`} />
                        {isConnected ? 'Transport Secure (WSS)' : 'Disconnected'}
                    </div>
                </div>
            </aside>
        </>
    );
}
