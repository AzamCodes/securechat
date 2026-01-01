
"use client";

import { useEffect, useState } from 'react';

/**
 * ServiceWorkerRegister
 * 
 * Handles strict PWA registration logic.
 * - Registers /sw.js
 * - Monitors for security updates
 * - Displays "Installed" indicator
 */
export default function ServiceWorkerRegister() {
    const [isPwa, setIsPwa] = useState(false);
    const [swUpdateAvailable, setSwUpdateAvailable] = useState(false);
    const [installPrompt, setInstallPrompt] = useState<any>(null);

    useEffect(() => {
        // 1. Register SW
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then((registration) => {
                    // Check for updates
                    registration.onupdatefound = () => {
                        const installingWorker = registration.installing;
                        if (installingWorker == null) return;
                        installingWorker.onstatechange = () => {
                            if (installingWorker.state === 'installed') {
                                if (navigator.serviceWorker.controller) {
                                    setSwUpdateAvailable(true);
                                }
                            }
                        };
                    };
                })
                .catch((e) => console.error('Secure SW Registration Failed', e));

            // Force reload on controller change (Safety)
            let refreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!refreshing) {
                    window.location.reload();
                    refreshing = true;
                }
            });
        }

        // 2. Check Display Mode & Installability
        const matchMedia = window.matchMedia('(display-mode: standalone)');
        setIsPwa(matchMedia.matches);
        const handler = (e: MediaQueryListEvent) => setIsPwa(e.matches);
        matchMedia.addEventListener('change', handler);

        // Capture install prompt
        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault();
            setInstallPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            matchMedia.removeEventListener('change', handler);
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };

    }, []);

    const handleInstallClick = async () => {
        if (!installPrompt) return;
        installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;
        if (outcome === 'accepted') {
            setInstallPrompt(null);
        }
    };

    // 3. Render Status Indicators
    if (swUpdateAvailable) {
        return (
            <div className="fixed bottom-4 left-4 z-[100] p-4 bg-orange-100 dark:bg-orange-900 border border-orange-300 text-orange-900 dark:text-orange-100 rounded-lg shadow-2xl text-sm flex items-center gap-4 animate-in slide-in-from-bottom-2">
                <div className="flex flex-col">
                    <span className="font-bold">Security Update Available</span>
                    <span className="text-xs opacity-80">Reload to apply latest hardening.</span>
                </div>
                <button
                    onClick={() => window.location.reload()}
                    className="px-3 py-1.5 bg-orange-600 text-white font-bold rounded hover:bg-orange-700 transition-colors"
                >
                    Reload Now
                </button>
            </div>
        );
    }

    // Show Install Button if not installed and prompt is available
    if (!isPwa && installPrompt) {
        return (
            <div className="fixed bottom-4 right-4 z-[100] animate-in slide-in-from-bottom-2">
                <button
                    onClick={handleInstallClick}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-lg shadow-lg hover:bg-blue-700 transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Install App
                </button>
            </div>
        );
    }

    if (isPwa) {
        return (
            <div className="fixed bottom-1 right-1 z-[40] pointer-events-none opacity-40 hover:opacity-100 transition-opacity">
                <div className="bg-black/5 dark:bg-white/5 backdrop-blur-sm px-1.5 py-0.5 rounded text-[9px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    ENCRYPTED APP
                </div>
            </div>
        );
    }

    return null;
}
