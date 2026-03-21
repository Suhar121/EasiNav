import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { motion, useDragControls } from 'framer-motion';
import { Grip, Maximize2, Minimize2, Pencil, Plus, Trash2 } from 'lucide-react';
import type { PointerEvent } from 'react';
import type { BoardType, Position2D, ViewMode } from '../types';
import { boardDndId, bookmarkDndId } from '../utils/dnd';
import { cn } from '../utils/cn';
import { LinkItem } from './LinkItem';

const DRAG_COMMIT_DISTANCE_PX = 6;

interface BoardProps {
  board: BoardType;
  viewMode: ViewMode;
  position: Position2D;
  isMinimized: boolean;
  compactBlur: boolean;
  deleteMode: boolean;
  dragDisabled: boolean;
  onPositionChange: (boardId: string, nextPosition: Position2D) => void;
  onToggleMinimize: (boardId: string) => void;
  onAddBookmark: (boardId: string) => void;
  onRenameBoard: (boardId: string) => void;
  onDeleteBoard: (boardId: string) => void;
  onEditBookmark: (boardId: string, bookmarkId: string) => void;
  onDeleteBookmark: (boardId: string, bookmarkId: string) => void;
  onToggleBookmarkFavorite: (boardId: string, bookmarkId: string) => void;
}

export function Board({
  board,
  viewMode,
  position,
  isMinimized,
  compactBlur,
  deleteMode,
  dragDisabled,
  onPositionChange,
  onToggleMinimize,
  onAddBookmark,
  onRenameBoard,
  onDeleteBoard,
  onEditBookmark,
  onDeleteBookmark,
  onToggleBookmarkFavorite,
}: BoardProps) {
  const dragControls = useDragControls();
  const { setNodeRef, isOver } = useDroppable({
    id: boardDndId(board.id),
    data: { type: 'board', boardId: board.id },
  });

  const handleCardDragStart = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragControls.start(event);
  };

  return (
    <motion.article
      ref={setNodeRef}
      drag={!dragDisabled}
      dragElastic={0.08}
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      whileDrag={{ scale: 1.015, zIndex: 90 }}
      onDragEnd={(_, info) => {
        if (
          Math.abs(info.offset.x) < DRAG_COMMIT_DISTANCE_PX &&
          Math.abs(info.offset.y) < DRAG_COMMIT_DISTANCE_PX
        ) {
          return;
        }

        onPositionChange(board.id, {
          x: position.x + info.offset.x,
          y: position.y + info.offset.y,
        });
      }}
      style={{ x: position.x, y: position.y }}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className={cn(
        'group flex min-h-[240px] flex-col rounded-3xl border border-white/12 bg-white/[0.065] p-4 backdrop-blur-2xl shadow-[0_14px_50px_rgba(0,0,0,0.45)] transition-all duration-300 hover:border-white/25 hover:shadow-[0_18px_80px_rgba(255,106,0,0.2)]',
        compactBlur ? 'blur-[6px] saturate-[0.6]' : '',
        isOver ? 'border-[#ff6a00]/75 shadow-[0_0_35px_rgba(255,106,0,0.3)]' : '',
        isMinimized ? 'min-h-[108px]' : ''
      )}
    >
        <header className="mb-3 flex items-center justify-between border-b border-white/10 pb-3">
          <h2 className="truncate text-base font-semibold tracking-wide text-slate-100">{board.title}</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onPointerDown={handleCardDragStart}
              disabled={dragDisabled}
              className={cn(
                'rounded-lg border border-white/10 bg-black/20 p-1.5 text-slate-400 transition-all duration-300',
                dragDisabled
                  ? 'cursor-not-allowed opacity-45'
                  : 'hover:border-white/20 hover:text-slate-100'
              )}
              aria-label={`Move ${board.title}`}
              title={dragDisabled ? 'Disable filters/search to move cards' : 'Drag card anywhere'}
            >
              <Grip size={14} />
            </button>
            <button
              type="button"
              onClick={() => onToggleMinimize(board.id)}
              className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-300 transition-all duration-200 hover:border-white/25 hover:text-white"
              aria-label={isMinimized ? `Expand ${board.title}` : `Minimize ${board.title}`}
              title={isMinimized ? 'Expand card' : 'Minimize card'}
            >
              {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
            </button>
            <button
              type="button"
              onClick={() => onAddBookmark(board.id)}
              className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-300 transition-all duration-200 hover:border-[#ff6a00]/60 hover:text-[#ff9b58]"
              aria-label={`Add link to ${board.title}`}
              title="Add link"
            >
              <Plus size={14} />
            </button>
            <button
              type="button"
              onClick={() => onRenameBoard(board.id)}
              className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-300 transition-all duration-200 hover:border-white/25 hover:text-white"
              aria-label={`Rename ${board.title}`}
              title="Rename board"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={() => onDeleteBoard(board.id)}
              className={cn(
                'rounded-lg border bg-white/5 p-1.5 transition-all duration-200',
                deleteMode
                  ? 'border-red-400/60 text-red-300 hover:bg-red-500/20'
                  : 'border-white/10 text-slate-300 hover:border-red-400/50 hover:text-red-300'
              )}
              aria-label={`Delete ${board.title}`}
              title="Delete board"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </header>

        {isMinimized ? (
          <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-white/15 bg-black/15 text-xs uppercase tracking-[0.2em] text-slate-400">
            {board.bookmarks.length} links
          </div>
        ) : (
          <SortableContext
            items={board.bookmarks.map((bookmark) => bookmarkDndId(bookmark.id))}
            strategy={verticalListSortingStrategy}
          >
            <div className={cn('flex flex-1 flex-col gap-1.5', viewMode === 'compact' ? 'gap-1' : 'gap-1.5')}>
              {board.bookmarks.length > 0 ? (
                board.bookmarks.map((bookmark) => (
                  <LinkItem
                    key={bookmark.id}
                    boardId={board.id}
                    bookmark={bookmark}
                    compactView={viewMode === 'compact'}
                    compactBlur={compactBlur}
                    deleteMode={deleteMode}
                    dragDisabled={dragDisabled}
                    onEdit={() => onEditBookmark(board.id, bookmark.id)}
                    onDelete={() => onDeleteBookmark(board.id, bookmark.id)}
                    onToggleFavorite={() => onToggleBookmarkFavorite(board.id, bookmark.id)}
                  />
                ))
              ) : (
                <button
                  type="button"
                  onClick={() => onAddBookmark(board.id)}
                  className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-white/15 bg-black/15 text-xs uppercase tracking-[0.2em] text-slate-400 transition-colors hover:border-[#ff6a00]/50 hover:text-[#ff9b58]"
                >
                  Add first link
                </button>
              )}
            </div>
          </SortableContext>
        )}
    </motion.article>
  );
}
