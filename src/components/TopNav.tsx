import { motion } from 'framer-motion';
import { Pencil, Plus, Trash2 } from 'lucide-react';
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
  return (
    <header className="px-4 pt-5 sm:px-8 sm:pt-7 lg:px-12">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 rounded-[24px] border border-white/10 bg-black/35 px-3 py-3 backdrop-blur-2xl shadow-[0_12px_60px_rgba(0,0,0,0.4)] sm:px-4">
        <nav className="futuristic-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
          {pages.map((page) => {
            const isActive = page.id === activePageId;

            return (
              <motion.button
                key={page.id}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                transition={{ duration: 0.18 }}
                onClick={() => onPageSelect(page.id)}
                className={cn(
                  'relative shrink-0 rounded-full border px-5 py-2.5 text-sm font-semibold tracking-wide transition-all duration-300',
                  isActive
                    ? 'border-[#ff6a00]/70 bg-[#ff6a00] text-black shadow-[0_0_24px_rgba(255,106,0,0.6)]'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/25 hover:bg-white/12 hover:text-white'
                )}
              >
                {page.title}
              </motion.button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.93 }}
            onClick={onRenameActivePage}
            className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-slate-200 backdrop-blur-xl transition-all duration-300 hover:border-[#ff6a00]/60 hover:bg-[#ff6a00]/20 hover:text-white"
            aria-label="Rename page"
            title="Rename page"
          >
            <Pencil size={16} />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.93 }}
            onClick={onDeleteActivePage}
            disabled={!canDeleteActivePage}
            className={cn(
              'group flex h-10 w-10 shrink-0 items-center justify-center rounded-full border backdrop-blur-xl transition-all duration-300',
              canDeleteActivePage
                ? 'border-white/20 bg-white/10 text-slate-200 hover:border-red-400/60 hover:bg-red-500/20 hover:text-red-200'
                : 'cursor-not-allowed border-white/10 bg-white/5 text-slate-500'
            )}
            aria-label="Delete page"
            title={canDeleteActivePage ? 'Delete page' : 'At least one page is required'}
          >
            <Trash2 size={16} />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.93 }}
            onClick={onAddPage}
            className="group flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-slate-200 backdrop-blur-xl transition-all duration-300 hover:border-[#ff6a00]/60 hover:bg-[#ff6a00]/20 hover:text-white hover:shadow-[0_0_24px_rgba(255,106,0,0.45)]"
            aria-label="Add page"
            title="Add page"
          >
            <Plus size={20} className="transition-transform duration-300 group-hover:rotate-90" />
          </motion.button>
        </div>
      </div>
    </header>
  );
}
