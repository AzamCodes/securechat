
"use client";
import { useEffect, useState } from 'react';
import { securityDB } from '@/lib/storage/db';

export default function SecurityEventsPage() {
    const [events, setEvents] = useState<any[]>([]);

    useEffect(() => {
        securityDB.getAll('security_events').then(data => {
            // Sort by ID (usually implies time) or timestamp if available
            setEvents(data.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
        });
    }, []);

    return (
        <div className="p-8 bg-slate-950 min-h-screen font-mono text-xs text-green-400">
            <header className="mb-6 border-b border-green-800 pb-2 flex justify-between items-end">
                <div>
                    <h1 className="text-xl font-bold">Local Security Audit Log</h1>
                    <p className="text-slate-500 mt-1">Events stored locally in IndexedDB. Never transmitted.</p>
                </div>
                <a href="/" className="text-blue-500 hover:underline">Back to Chat</a>
            </header>

            <div className="space-y-1">
                {events.map((e, i) => (
                    <div key={i} className="flex flex-col md:flex-row gap-2 md:gap-4 hover:bg-green-900/20 p-2 border-b border-green-900/30">
                        <span className="text-slate-500 min-w-[180px]">{new Date(e.timestamp).toISOString()}</span>
                        <span className={`font-bold min-w-[120px] ${e.severity === 'CRITICAL' ? 'text-red-500' :
                                e.severity === 'WARNING' ? 'text-orange-400' : 'text-blue-400'
                            }`}>[{e.type}]</span>
                        <span className="break-all">{e.message}</span>
                        {e.meta && <span className="text-slate-600 hidden md:inline">{JSON.stringify(e.meta)}</span>}
                    </div>
                ))}
                {events.length === 0 && <p className="text-slate-600 italic">No security anomalies detected yet.</p>}
            </div>
        </div>
    );
}
