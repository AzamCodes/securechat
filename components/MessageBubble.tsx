
import { Message } from '../hooks/useSecureChat';
import { useState, useEffect, useRef } from 'react';

export default function MessageBubble({
    msg,
    onDelete,
    onEdit
}: {
    msg: Message;
    onDelete: (id: string) => void;
    onEdit?: (id: string, newText: string) => void;
}) {
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(msg.text);
    const [isDeleting, setIsDeleting] = useState(false);

    const menuRef = useRef<HTMLDivElement>(null);
    const editInputRef = useRef<HTMLTextAreaElement>(null);

    // Timer Logic
    useEffect(() => {
        if (!msg.expiresAt) return;
        const update = () => {
            const remaining = Math.ceil((msg.expiresAt! - Date.now()) / 1000);
            setTimeLeft(remaining > 0 ? remaining : 0);
        };
        update();
        const t = setInterval(update, 1000);
        return () => clearInterval(t);
    }, [msg.expiresAt]);

    // Click Outside for Menu
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setMenuOpen(false);
            }
        };
        if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [menuOpen]);

    // Auto-focus edit input
    useEffect(() => {
        if (isEditing && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.setSelectionRange(editInputRef.current.value.length, editInputRef.current.value.length);
        }
    }, [isEditing]);

    // Internal Expiry Check (Moved to avoid conditional hook call violation)
    if (msg.expiresAt && msg.expiresAt < Date.now()) return null;

    const handleDelete = () => {
        setMenuOpen(false);
        setIsDeleting(true);
        // Wait for animation
        setTimeout(() => onDelete(msg.id), 300);
    };

    const handleSaveEdit = () => {
        if (editValue.trim() && editValue !== msg.text) {
            if (onEdit) onEdit(msg.id, editValue);
        }
        setIsEditing(false);
        setMenuOpen(false);
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(msg.text);
        setMenuOpen(false);
    };

    const isOwn = msg.isOwn;

    return (
        <div
            className={`
                flex w-full mb-3 select-none
                ${isOwn ? 'justify-end' : 'justify-start'}
                ${isDeleting ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}
                transition-all duration-300 ease-out
                animate-in slide-in-from-bottom-2 fade-in
            `}
        >
            <div className={`relative max-w-[85%] md:max-w-[70%] group flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>

                {/* Bubble */}
                <div
                    className={`
                        relative px-4 py-3 shadow-sm text-sm md:text-base leading-relaxed break-words min-w-[120px]
                        ${isOwn
                            ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl rounded-tl-sm border border-slate-200 dark:border-slate-700'
                        }
                    `}
                >
                    {isEditing ? (
                        <div className="min-w-[200px]">
                            <textarea
                                ref={editInputRef}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSaveEdit();
                                    }
                                    if (e.key === 'Escape') setIsEditing(false);
                                }}
                                className="w-full bg-transparent text-inherit resize-none outline-none border-b border-white/30 dark:border-slate-500/30 pb-1 mb-1"
                                rows={Math.min(editValue.split('\n').length + 1, 5)}
                            />
                            <div className="flex justify-end gap-2 text-[10px] opacity-80">
                                <button onClick={() => setIsEditing(false)} className="hover:underline">Cancel</button>
                                <button onClick={handleSaveEdit} className="font-bold hover:underline">Save</button>
                            </div>
                        </div>
                    ) : (
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                    )}

                    {/* Metadata Footer */}
                    <div className={`
                        flex items-center gap-2 mt-1.5 text-[10px] 
                        ${isOwn ? 'text-blue-100 justify-end' : 'text-slate-400 dark:text-slate-500 justify-start'}
                    `}>
                        {/* Read Once / Timer */}
                        {(msg.rules?.readOnce || (timeLeft !== null && timeLeft > 0)) && (
                            <span className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-md ${isOwn ? 'bg-black/10' : 'bg-slate-100 dark:bg-slate-700/50'}`}>
                                {msg.rules?.readOnce && <span>💥</span>}
                                {timeLeft !== null && timeLeft > 0 && (
                                    <span className="tabular-nums font-medium tracking-wide">{timeLeft}s</span>
                                )}
                            </span>
                        )}

                        {msg.isEdited && (
                            <span className="italic opacity-70 mr-1">(edited)</span>
                        )}
                        <span className="opacity-70">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>

                    {/* Context Menu Trigger (Three dots) - Allow for ALL messages */}
                    {!isEditing && (
                        <button
                            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
                            className={`
                                absolute top-1 right-1 p-1 rounded-full opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity
                                ${menuOpen ? 'opacity-100 bg-black/10' : ''}
                                hover:bg-black/10 dark:hover:bg-white/10 text-inherit
                            `}
                            aria-label="Message options"
                        >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" /></svg>
                        </button>
                    )}
                </div>

                {/* Dropdown Menu */}
                {menuOpen && (
                    <div
                        ref={menuRef}
                        className="absolute right-0 top-8 z-10 w-32 bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right"
                    >
                        {isOwn && (
                            <button onClick={() => { setIsEditing(true); setMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2">
                                <span>✏️</span> Edit
                            </button>
                        )}
                        <button onClick={handleCopy} className="w-full text-left px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2">
                            <span>📋</span> Copy
                        </button>
                        <div className="h-px bg-slate-100 dark:bg-slate-800 my-0.5"></div>
                        <button onClick={handleDelete} className="w-full text-left px-4 py-2.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 flex items-center gap-2">
                            <span>🗑</span> Delete
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
