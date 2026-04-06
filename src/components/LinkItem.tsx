import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { Globe, GripVertical, KeyRound, MoreVertical, Pencil, Pin, Star, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Bookmark } from '../types';
import { bookmarkDndId } from '../utils/dnd';
import { cn } from '../utils/cn';

interface LinkItemProps {
  boardId: string;
  bookmark: Bookmark;
  compactBlur: boolean;
  deleteMode: boolean;
  dragDisabled: boolean;
  attachmentCount: number;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  onTogglePinned: () => void;
  onAttachToVault: () => void;
  onOpen: () => void;
}

export function LinkItem({
  boardId,
  bookmark,
  compactBlur,
  deleteMode,
  dragDisabled,
  attachmentCount,
  onEdit,
  onDelete,
  onToggleFavorite,
  onTogglePinned,
  onAttachToVault,
  onOpen,
}: LinkItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: bookmarkDndId(bookmark.id),
    data: { type: 'bookmark', boardId, bookmarkId: bookmark.id },
    disabled: dragDisabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const compactUrl = bookmark.url
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '');
  const readableUrl =
    compactUrl.length > 48
      ? `${compactUrl.slice(0, 34)}…${compactUrl.slice(-12)}`
      : compactUrl;

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }

      if (menuRef.current?.contains(target)) {
        return;
      }

      setIsMenuOpen(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isMenuOpen]);

  const handleMenuAction = (action: () => void) => {
    action();
    setIsMenuOpen(false);
  };

  return (
    <motion.div
      ref={setNodeRef}
      data-no-card-drag
      style={style}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.14 }}
      className={cn(
        'group relative flex items-center gap-1 rounded-md border border-transparent px-1 py-0.5 text-left transition-colors duration-150 hover:border-white/10 hover:bg-white/8',
        compactBlur ? 'blur-[2px]' : '',
        deleteMode ? 'border-red-500/30 hover:border-red-400/50' : '',
        isDragging ? 'z-50 border-white/30 bg-white/8' : '',
        isMenuOpen ? 'z-[70]' : ''
      )}
    >
      <button
        type="button"
        data-no-card-drag
        {...attributes}
        {...listeners}
        disabled={dragDisabled}
        className={cn(
          'rounded-md p-1 text-slate-500 opacity-0 transition-all duration-200 group-hover:opacity-100 hover:text-slate-300',
          dragDisabled ? 'cursor-not-allowed opacity-40' : 'cursor-grab active:cursor-grabbing'
        )}
        aria-label={`Drag ${bookmark.title}`}
        title={dragDisabled ? 'Disable filters/search to drag' : 'Drag link'}
      >
        <GripVertical size={13} />
      </button>

      <a
        href={bookmark.url}
        data-no-card-drag
        className="flex min-w-0 flex-1 items-center gap-2"
        title={bookmark.url}
        onClick={(event) => {
          event.preventDefault();
          setIsMenuOpen(false);
          onOpen();
        }}
      >
        <div className="flex h-6.5 w-6.5 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-black/30">
          {bookmark.icon ? (
            <img src={bookmark.icon} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <Globe size={13} className="text-slate-300/85" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-medium leading-4 text-slate-200">{bookmark.title}</p>
          <p className="truncate text-[11px] leading-4 text-slate-400">{readableUrl}</p>
        </div>
      </a>

      <div
        ref={menuRef}
        data-no-card-drag
        className={cn(
          'relative flex items-center opacity-0 transition-opacity duration-200 group-hover:opacity-100',
          deleteMode || isMenuOpen ? 'opacity-100' : '',
          isMenuOpen ? 'z-[80]' : ''
        )}
      >
        <button
          type="button"
          data-no-card-drag
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setIsMenuOpen((current) => !current);
          }}
          className={cn(
            'rounded-md p-1 transition-colors',
            isMenuOpen ? 'text-slate-200' : 'text-slate-500 hover:text-slate-300'
          )}
          aria-label="Link actions"
          title="Link actions"
        >
          <MoreVertical size={14} />
        </button>

        {isMenuOpen ? (
          <div className="absolute right-0 top-6 z-[90] w-40 overflow-hidden rounded-lg border border-white/12 bg-[#06080f] p-1.5 shadow-[0_14px_30px_rgba(0,0,0,0.58)]">
            <button
              type="button"
              data-no-card-drag
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleMenuAction(onToggleFavorite);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-200 transition-colors hover:bg-white/8"
            >
              <Star size={12} fill={bookmark.favorite ? 'currentColor' : 'none'} />
              {bookmark.favorite ? 'Unfavorite' : 'Favorite'}
            </button>
            <button
              type="button"
              data-no-card-drag
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleMenuAction(onAttachToVault);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-200 transition-colors hover:bg-white/8"
            >
              <KeyRound size={12} />
              {attachmentCount > 0
                ? `${attachmentCount} vault entr${attachmentCount === 1 ? 'y' : 'ies'} attached`
                : 'Attach vault entry'}
            </button>
            <button
              type="button"
              data-no-card-drag
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleMenuAction(onTogglePinned);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-200 transition-colors hover:bg-white/8"
            >
              <Pin size={12} fill={bookmark.pinned ? 'currentColor' : 'none'} />
              {bookmark.pinned ? 'Unpin' : 'Pin'}
            </button>
            <button
              type="button"
              data-no-card-drag
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleMenuAction(onEdit);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-200 transition-colors hover:bg-white/8"
            >
              <Pencil size={12} />
              Edit link
            </button>
            <button
              type="button"
              data-no-card-drag
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleMenuAction(onDelete);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-red-300 transition-colors hover:bg-red-500/15"
            >
              <Trash2 size={12} />
              Delete link
            </button>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
