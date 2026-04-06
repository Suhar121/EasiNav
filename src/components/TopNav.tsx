import { motion } from 'framer-motion';
import { MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { PageType } from '../types';
import { cn } from '../utils/cn';

interface TopNavProps {
  pages: PageType[];
  activePageId: string;
  onPageSelect: (id: string) => void;
  onAddPage: () => void;
  onRenameActivePage: () => void;
  onDeleteActivePage: () => void;
  canDeleteActivePage: boolean;
}

export function TopNav({
  pages,
  activePageId,
  onPageSelect,
  onAddPage,
  onRenameActivePage,
  onDeleteActivePage,
  canDeleteActivePage,
}: TopNavProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target || menuRef.current?.contains(target)) {
        return;
      }

      setIsMenuOpen(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isMenuOpen]);

  return (
    <header className="px-4 pt-4 sm:px-8 sm:pt-5 lg:px-10">
      <div className="mx-auto flex max-w-[1380px] items-center justify-between gap-4 rounded-2xl border border-white/12 bg-black/26 px-3 py-2 backdrop-blur-sm sm:px-4">
        <nav className="futuristic-scrollbar flex items-center gap-2 overflow-x-auto py-0.5">
          {pages.map((page) => {
            const isActive = page.id === activePageId;

            return (
              <motion.button
                key={page.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.22 }}
                onClick={() => onPageSelect(page.id)}
                className={cn(
                  'relative shrink-0 rounded-xl border px-5 py-2 text-sm font-semibold transition-all duration-200',
                  isActive
                    ? 'border-white/25 bg-white/82 text-zinc-900'
                    : 'border-white/10 bg-black/25 text-slate-300 hover:border-white/20 hover:bg-white/10 hover:text-slate-100'
                )}
              >
                {page.title}
              </motion.button>
            );
          })}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.93 }}
            onClick={onAddPage}
            className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-black/25 text-slate-200 transition-colors duration-200 hover:border-white/28 hover:bg-white/12 hover:text-white"
            aria-label="Add page"
            title="Add page"
          >
            <Plus size={18} className="transition-transform duration-300 group-hover:rotate-90" />
          </motion.button>
        </nav>

        <div className="relative" ref={menuRef}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => setIsMenuOpen((current) => !current)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/12 bg-black/25 text-slate-300 transition-colors duration-200 hover:border-white/24 hover:bg-white/10 hover:text-slate-100"
            aria-label="Page options"
            title="Page options"
          >
            <MoreVertical size={16} />
          </motion.button>

          {isMenuOpen ? (
            <div className="absolute right-0 top-11 z-50 w-44 rounded-xl border border-white/14 bg-black/80 p-1.5 backdrop-blur-md">
              <button
                type="button"
                onClick={() => {
                  onRenameActivePage();
                  setIsMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-white/10"
              >
                <Pencil size={14} />
                Rename page
              </button>
              <button
                type="button"
                onClick={() => {
                  if (canDeleteActivePage) {
                    onDeleteActivePage();
                  }
                  setIsMenuOpen(false);
                }}
                disabled={!canDeleteActivePage}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                  canDeleteActivePage
                    ? 'text-red-200 hover:bg-red-500/15'
                    : 'cursor-not-allowed text-slate-500'
                )}
              >
                <Trash2 size={14} />
                Delete page
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
