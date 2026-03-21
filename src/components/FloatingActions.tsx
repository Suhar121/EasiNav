import { motion } from 'framer-motion';
import {
  Download,
  Eye,
  EyeOff,
  LayoutGrid,
  Search,
  Settings,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { cn } from '../utils/cn';

interface ActionItem {
  id: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  onClick: () => void;
  active?: boolean;
  highlight?: boolean;
}

interface FloatingActionsProps {
  onSearch: () => void;
  onDownload: () => void;
  onFilter: () => void;
  onIncognitoToggle: () => void;
  onLayoutToggle: () => void;
  onDeleteModeToggle: () => void;
  onViewModeToggle: () => void;
  onSettings: () => void;
  isSearchActive: boolean;
  isFavoritesFilterActive: boolean;
  isIncognito: boolean;
  isListLayout: boolean;
  isDeleteMode: boolean;
  isCompactView: boolean;
  isSettingsOpen: boolean;
}

export function FloatingActions({
  onSearch,
  onDownload,
  onFilter,
  onIncognitoToggle,
  onLayoutToggle,
  onDeleteModeToggle,
  onViewModeToggle,
  onSettings,
  isSearchActive,
  isFavoritesFilterActive,
  isIncognito,
  isListLayout,
  isDeleteMode,
  isCompactView,
  isSettingsOpen,
}: FloatingActionsProps) {
  const actions: ActionItem[] = [
    { id: 'search', label: 'Search', icon: Search, onClick: onSearch, active: isSearchActive },
    { id: 'download', label: 'Download', icon: Download, onClick: onDownload },
    { id: 'filter', label: 'Filter', icon: SlidersHorizontal, onClick: onFilter, active: isFavoritesFilterActive },
    { id: 'incognito', label: 'Incognito', icon: EyeOff, onClick: onIncognitoToggle, active: isIncognito },
    {
      id: 'grid',
      label: isListLayout ? 'Grid layout' : 'List layout',
      icon: LayoutGrid,
      onClick: onLayoutToggle,
      active: isListLayout,
    },
    { id: 'delete', label: 'Delete mode', icon: Trash2, onClick: onDeleteModeToggle, active: isDeleteMode },
    { id: 'view', label: 'Compact view', icon: Eye, onClick: onViewModeToggle, active: isCompactView },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      onClick: onSettings,
      highlight: true,
      active: isSettingsOpen,
    },
  ];

  return (
    <aside className="fixed right-3 top-1/2 z-30 -translate-y-1/2 sm:right-5">
      <div className="flex flex-col gap-3 rounded-[28px] border border-white/10 bg-black/25 p-2.5 backdrop-blur-2xl">
        {actions.map((action) => {
          const active = Boolean(action.active);
          const highlight = Boolean(action.highlight);

          return (
            <motion.button
              key={action.id}
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.94 }}
              onClick={action.onClick}
              className={cn(
                'group relative flex h-12 w-12 items-center justify-center rounded-full border transition-all duration-300',
                highlight
                  ? 'border-[#ff6a00]/70 bg-[#ff6a00] text-black shadow-[0_0_26px_rgba(255,106,0,0.55)]'
                  : active
                    ? 'border-[#ff6a00]/60 bg-[#ff6a00]/25 text-white shadow-[0_0_20px_rgba(255,106,0,0.35)]'
                    : 'border-white/15 bg-white/10 text-slate-100 hover:border-[#ff6a00]/60 hover:bg-[#ff6a00]/20 hover:text-white hover:shadow-[0_0_24px_rgba(255,106,0,0.38)]'
              )}
              aria-label={action.label}
              title={action.label}
            >
              <action.icon size={18} />
              <span className="pointer-events-none absolute right-[3.35rem] hidden -translate-x-2 whitespace-nowrap rounded-lg border border-white/15 bg-black/80 px-2.5 py-1 text-xs font-medium text-slate-100 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 lg:block">
                {action.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </aside>
  );
}
