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

export function FloatingActions(props: FloatingActionsProps) {
  const {
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
  } = props;
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
      active: isSettingsOpen,
      highlight: true,
    },
  ];

  return (
    <aside className="fixed right-3 top-1/2 z-30 -translate-y-1/2 sm:right-5">
      <div className="flex flex-col gap-3">
        {actions.map((action) => {
          const active = Boolean(action.active);
          const highlight = Boolean(action.highlight);
          const isSettings = action.id === 'settings';

          return (
            <motion.button
              key={action.id}
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.94 }}
              onClick={action.onClick}
              className={cn(
                'group relative flex items-center justify-center rounded-full border backdrop-blur-sm transition-all duration-200',
                isSettings ? 'mt-1 h-12 w-12' : 'h-12 w-12',
                highlight
                  ? active
                    ? 'border-white/25 bg-white/85 text-zinc-900 shadow-[0_4px_18px_rgba(255,255,255,0.22)]'
                    : 'border-white/22 bg-white/78 text-zinc-900'
                  : active
                    ? 'border-white/22 bg-white/15 text-slate-100 shadow-[0_0_18px_rgba(255,255,255,0.08)]'
                    : 'border-white/16 bg-black/34 text-slate-200 hover:border-white/26 hover:bg-white/12 hover:text-white'
              )}
              aria-label={action.label}
              title={action.label}
            >
              <action.icon size={18} />
              <span className="pointer-events-none absolute right-[3.2rem] hidden -translate-x-2 whitespace-nowrap rounded-md border border-white/15 bg-black/75 px-2 py-1 text-xs font-medium text-slate-100 opacity-0 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100 lg:block">
                {action.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </aside>
  );
}
