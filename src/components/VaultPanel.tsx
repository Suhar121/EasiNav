import { motion, useDragControls } from 'framer-motion';
import { Copy, ExternalLink, Eye, EyeOff, Grip, KeyRound, Lock, Maximize2, Minimize2, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent, PointerEvent } from 'react';
import type { Position2D, VaultEntry } from '../types';
import { cn } from '../utils/cn';

interface VaultDraft {
  title: string;
  username: string;
  password: string;
  website: string;
  linkedBookmarkUrl?: string;
  notes: string;
}

interface VaultPrefillDraft {
  title: string;
  website: string;
  linkedBookmarkUrl?: string;
  token: string;
}

interface VaultPanelProps {
  entries: VaultEntry[];
  position: Position2D;
  isMinimized: boolean;
  onPositionChange: (nextPosition: Position2D) => void;
  onToggleMinimize: () => void;
  onLock?: () => void;
  onAddEntry: (draft: VaultDraft) => boolean;
  onDeleteEntry: (entryId: string) => void;
  onOpenWebsite: (entryId: string) => void;
  onCopyValue: (value: string, label: string) => void;
  prefillDraft?: VaultPrefillDraft | null;
  onHide?: () => void;
}

export function VaultPanel({
  entries,
  position,
  isMinimized,
  onPositionChange,
  onToggleMinimize,
  onLock,
  onAddEntry,
  onDeleteEntry,
  onOpenWebsite,
  onCopyValue,
  prefillDraft,
  onHide,
}: VaultPanelProps) {
  const [title, setTitle] = useState(() => prefillDraft?.title ?? '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [website, setWebsite] = useState(() => prefillDraft?.website ?? '');
  const [linkedBookmarkUrl, setLinkedBookmarkUrl] = useState<string | undefined>(
    prefillDraft?.linkedBookmarkUrl ?? prefillDraft?.website
  );
  const [notes, setNotes] = useState('');
  const [revealedIds, setRevealedIds] = useState<string[]>([]);

  const dragControls = useDragControls();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    const success = onAddEntry({
      title,
      username,
      password,
      website,
      linkedBookmarkUrl,
      notes,
    });

    if (!success) {
      return;
    }

    setTitle('');
    setUsername('');
    setPassword('');
    setWebsite('');
    setLinkedBookmarkUrl(undefined);
    setNotes('');
  };

  const handleDragStart = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragControls.start(event);
  };

  const toggleReveal = (entryId: string) => {
    setRevealedIds((current) =>
      current.includes(entryId)
        ? current.filter((id) => id !== entryId)
        : [...current, entryId]
    );
  };

  return (
    <motion.section
      drag
      dragElastic={0.08}
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      whileDrag={{ scale: 1.01, zIndex: 90 }}
      onDragEnd={(_, info) => {
        onPositionChange({
          x: position.x + info.offset.x,
          y: position.y + info.offset.y,
        });
      }}
      style={{ x: position.x, y: position.y }}
      className={cn(
        'fixed bottom-4 left-4 z-40 rounded-2xl border border-white/12 bg-black/28 p-3 backdrop-blur-sm shadow-[0_8px_24px_rgba(0,0,0,0.24)] sm:bottom-5 sm:left-5',
        isMinimized ? 'w-[220px]' : 'w-[340px]'
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-100">
          <KeyRound size={14} className="text-slate-300" />
          <h3 className="text-xs font-semibold tracking-wide">Vault</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onPointerDown={handleDragStart}
            className="rounded-md border border-white/12 bg-black/25 p-1 text-slate-300 transition-colors hover:border-white/20 hover:text-slate-100"
            aria-label="Drag vault card"
            title="Drag card"
          >
            <Grip size={13} />
          </button>
          <button
            type="button"
            onClick={onToggleMinimize}
            className="rounded-md border border-white/12 bg-black/25 p-1 text-slate-300 transition-colors hover:border-white/20 hover:text-slate-100"
            aria-label={isMinimized ? 'Expand vault card' : 'Minimize vault card'}
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
          </button>
          {onLock ? (
            <button
              type="button"
              onClick={onLock}
              className="rounded-md border border-white/12 bg-black/25 p-1 text-slate-300 transition-colors hover:border-white/20 hover:text-slate-100"
              aria-label="Lock vault"
              title="Lock vault"
            >
              <Lock size={13} />
            </button>
          ) : null}
          {onHide ? (
            <button
              type="button"
              onClick={onHide}
              className="rounded-md border border-white/12 bg-black/25 p-1 text-slate-300 transition-colors hover:border-white/20 hover:text-slate-100"
              aria-label="Hide vault card"
              title="Hide vault"
            >
              <X size={13} />
            </button>
          ) : null}
        </div>
      </div>

      {isMinimized ? (
        <p className="text-[11px] text-slate-300">{entries.length} saved</p>
      ) : (
        <>
          <p className="mb-2 text-[11px] text-slate-300">Stored only in your local browser data.</p>

          {linkedBookmarkUrl ? (
            <p className="mb-1.5 rounded-md border border-[#ff9b58]/35 bg-[#ff9b58]/10 px-2 py-1 text-[11px] text-[#ffc9a4]">
              Attached to selected link
            </p>
          ) : null}

          <form onSubmit={handleSubmit} className="mb-2 space-y-1.5">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Service (GitHub, Banking, etc.)"
              className="w-full rounded-md border border-white/12 bg-black/25 px-2.5 py-1.5 text-xs text-slate-100 outline-none transition-colors focus:border-white/25"
            />
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Email / username"
              className="w-full rounded-md border border-white/12 bg-black/25 px-2.5 py-1.5 text-xs text-slate-100 outline-none transition-colors focus:border-white/25"
            />
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password / secret"
              className="w-full rounded-md border border-white/12 bg-black/25 px-2.5 py-1.5 text-xs text-slate-100 outline-none transition-colors focus:border-white/25"
            />
            <input
              value={website}
              onChange={(event) => {
                setWebsite(event.target.value);
                if (!event.target.value.trim()) {
                  setLinkedBookmarkUrl(undefined);
                }
              }}
              placeholder="Website (optional)"
              className="w-full rounded-md border border-white/12 bg-black/25 px-2.5 py-1.5 text-xs text-slate-100 outline-none transition-colors focus:border-white/25"
            />
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Important note (optional)"
              rows={2}
              className="w-full resize-none rounded-md border border-white/12 bg-black/25 px-2.5 py-1.5 text-xs text-slate-100 outline-none transition-colors focus:border-white/25"
            />

            <button
              type="submit"
              className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-white/12 bg-black/25 text-xs text-slate-100 transition-colors hover:border-white/25 hover:text-slate-100"
            >
              <Plus size={13} />
              Save entry
            </button>
          </form>

          <div className="futuristic-scrollbar max-h-52 space-y-1.5 overflow-y-auto pr-0.5">
            {entries.length === 0 ? (
              <p className="rounded-lg border border-dashed border-white/20 py-2.5 text-center text-[11px] text-slate-400">
                No entries yet
              </p>
            ) : (
              entries.map((entry) => {
                const revealed = revealedIds.includes(entry.id);
                const maskedPassword = entry.password ? '•'.repeat(Math.max(8, entry.password.length)) : '—';

                return (
                  <motion.div
                    key={entry.id}
                    layout
                    className="rounded-md border border-white/10 bg-black/20 px-2 py-1.5"
                  >
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-slate-100">{entry.title}</p>
                        {entry.username ? (
                          <p className="truncate text-[11px] text-slate-300">{entry.username}</p>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        onClick={() => onDeleteEntry(entry.id)}
                        className="rounded-md p-1 text-slate-500 transition-colors hover:text-red-300"
                        aria-label={`Delete ${entry.title}`}
                        title="Delete entry"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    <p className="mb-1 truncate text-[11px] text-slate-300">
                      Password: {revealed ? entry.password || '—' : maskedPassword}
                    </p>

                    {entry.notes ? (
                      <p className="mb-1.5 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-slate-300">
                        {entry.notes}
                      </p>
                    ) : null}

                    <div className="flex flex-wrap gap-1">
                      {entry.website ? (
                        <button
                          type="button"
                          onClick={() => onOpenWebsite(entry.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-white/12 bg-black/30 px-2 py-1 text-[11px] text-slate-200 transition-colors hover:border-white/22"
                          title="Open website"
                        >
                          <ExternalLink size={11} />
                          Open
                        </button>
                      ) : null}

                      {entry.username ? (
                        <button
                          type="button"
                          onClick={() => onCopyValue(entry.username, 'Username')}
                          className="inline-flex items-center gap-1 rounded-md border border-white/12 bg-black/30 px-2 py-1 text-[11px] text-slate-200 transition-colors hover:border-white/22"
                          title="Copy username"
                        >
                          <Copy size={11} />
                          User
                        </button>
                      ) : null}

                      {entry.password ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onCopyValue(entry.password, 'Password')}
                            className="inline-flex items-center gap-1 rounded-md border border-white/12 bg-black/30 px-2 py-1 text-[11px] text-slate-200 transition-colors hover:border-white/22"
                            title="Copy password"
                          >
                            <Copy size={11} />
                            Pass
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleReveal(entry.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-white/12 bg-black/30 px-2 py-1 text-[11px] text-slate-200 transition-colors hover:border-white/22"
                            title={revealed ? 'Hide password' : 'Show password'}
                          >
                            {revealed ? <EyeOff size={11} /> : <Eye size={11} />}
                            {revealed ? 'Hide' : 'Show'}
                          </button>
                        </>
                      ) : null}
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </>
      )}
    </motion.section>
  );
}
