import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { ExternalLink, Globe, GripVertical, Pencil, Star, Trash2 } from 'lucide-react';
import type { Bookmark } from '../types';
import { bookmarkDndId } from '../utils/dnd';
import { cn } from '../utils/cn';

interface LinkItemProps {
  boardId: string;
  bookmark: Bookmark;
  compactView: boolean;
  compactBlur: boolean;
  deleteMode: boolean;
  dragDisabled: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}

export function LinkItem({
  boardId,
  bookmark,
  compactView,
  compactBlur,
  deleteMode,
  dragDisabled,
  onEdit,
  onDelete,
  onToggleFavorite,
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

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      whileHover={{ scale: 1.02, x: 4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.16 }}
      className={cn(
        'group flex items-center gap-2 rounded-xl border border-transparent px-2 py-2 text-left transition-all duration-300 hover:border-white/15 hover:bg-white/10 hover:shadow-[0_0_16px_rgba(255,255,255,0.06)]',
        compactBlur ? 'blur-[2px]' : '',
        deleteMode ? 'border-red-500/30 hover:border-red-400/50' : '',
        isDragging ? 'z-50 border-[#ff6a00]/60 bg-[#ff6a00]/10 shadow-[0_0_28px_rgba(255,106,0,0.35)]' : ''
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        disabled={dragDisabled}
        className={cn(
          'rounded-md p-1 text-slate-500 transition-colors hover:text-slate-200',
          dragDisabled ? 'cursor-not-allowed opacity-40' : 'cursor-grab active:cursor-grabbing'
        )}
        aria-label={`Drag ${bookmark.title}`}
        title={dragDisabled ? 'Disable filters/search to drag' : 'Drag link'}
      >
        <GripVertical size={13} />
      </button>

      <a href={bookmark.url} className="flex min-w-0 flex-1 items-center gap-3" title={bookmark.url}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/30">
          {bookmark.icon ? (
            <img src={bookmark.icon} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <Globe size={16} className="text-slate-300/85" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-100">{bookmark.title}</p>
          {!compactView ? (
            <p className="truncate text-xs text-slate-400/90">
              {bookmark.url.replace(/^https?:\/\//i, '')}
            </p>
          ) : null}
        </div>
      </a>

      <div className={cn('flex items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100', deleteMode ? 'opacity-100' : '')}>
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            onToggleFavorite();
          }}
          className={cn(
            'rounded-md p-1 transition-colors',
            bookmark.favorite
              ? 'text-[#ffb347] hover:text-[#ffc678]'
              : 'text-slate-500 hover:text-slate-200'
          )}
          aria-label={bookmark.favorite ? 'Unfavorite link' : 'Favorite link'}
          title={bookmark.favorite ? 'Unfavorite' : 'Favorite'}
        >
          <Star size={14} fill={bookmark.favorite ? 'currentColor' : 'none'} />
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            onEdit();
          }}
          className="rounded-md p-1 text-slate-500 transition-colors hover:text-slate-200"
          aria-label="Edit link"
          title="Edit link"
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            onDelete();
          }}
          className={cn(
            'rounded-md p-1 transition-colors',
            deleteMode ? 'text-red-300 hover:text-red-100' : 'text-slate-500 hover:text-red-300'
          )}
          aria-label="Delete link"
          title="Delete link"
        >
          <Trash2 size={14} />
        </button>
        <a href={bookmark.url} className="rounded-md p-1 text-slate-500 transition-colors hover:text-[#ff9b58]" title="Open link">
          <ExternalLink size={14} />
        </a>
      </div>
    </motion.div>
  );
}
