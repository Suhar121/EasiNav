import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { motion, useDragControls } from 'framer-motion';
import { Link2, Maximize2, Minimize2, MoreVertical, MoveDiagonal2, Pencil, Pin, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { BoardSizePreset, BoardType, Position2D, ViewMode } from '../types';
import { boardDndId, bookmarkDndId } from '../utils/dnd';
import { cn } from '../utils/cn';
import { LinkItem } from './LinkItem';

const MAX_VISIBLE_LINKS_BY_SIZE: Record<BoardSizePreset, number> = {
  compact: 3,
  normal: 4,
  expanded: 6,
};

interface BoardProps {
  board: BoardType;
  viewMode: ViewMode;
  sizePreset: BoardSizePreset;
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
  onBoardSizeChange: (boardId: string, preset: BoardSizePreset) => void;
  onResetBoardSize: (boardId: string) => void;
  onToggleBoardPinned: (boardId: string) => void;
  onEditBookmark: (boardId: string, bookmarkId: string) => void;
  onDeleteBookmark: (boardId: string, bookmarkId: string) => void;
  onToggleBookmarkFavorite: (boardId: string, bookmarkId: string) => void;
  onToggleBookmarkPinned: (boardId: string, bookmarkId: string) => void;
  onAttachBookmarkToVault: (boardId: string, bookmarkId: string) => void;
  getBookmarkAttachmentCount: (bookmarkUrl: string) => number;
  onOpenBookmark: (boardId: string, bookmarkId: string) => void;
}

export function Board({
  board,
  viewMode,
  sizePreset,
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
  onBoardSizeChange,
  onResetBoardSize,
  onToggleBoardPinned,
  onEditBookmark,
  onDeleteBookmark,
  onToggleBookmarkFavorite,
  onToggleBookmarkPinned,
  onAttachBookmarkToVault,
  getBookmarkAttachmentCount,
  onOpenBookmark,
}: BoardProps) {
  const dragControls = useDragControls();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const maxVisibleLinks = MAX_VISIBLE_LINKS_BY_SIZE[sizePreset];
  const visibleBookmarks = board.bookmarks.slice(0, maxVisibleLinks);
  const hiddenBookmarksCount = Math.max(0, board.bookmarks.length - maxVisibleLinks);

  const { setNodeRef, isOver } = useDroppable({
    id: boardDndId(board.id),
    data: { type: 'board', boardId: board.id },
  });

  const isInteractiveTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    return Boolean(target.closest('a, button, input, textarea, select, [data-no-card-drag]'));
  };

  const handleCardPointerDownCapture = (event: ReactPointerEvent<HTMLElement>) => {
    if (dragDisabled || isInteractiveTarget(event.target)) {
      return;
    }

    dragControls.start(event);
  };

  const handleCardDragStart = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragControls.start(event);
  };

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
    <motion.article
      ref={setNodeRef}
      drag={!dragDisabled}
      dragElastic={0.01}
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      whileDrag={{ scale: 1.015, zIndex: 90 }}
      onDragEnd={(_, info) => {
        onPositionChange(board.id, {
          x: position.x + info.offset.x,
          y: position.y + info.offset.y,
        });
      }}
      style={{
        x: position.x,
        y: position.y,
        touchAction: 'none',
      }}
      className={cn(
        'group relative flex min-h-[220px] w-full flex-col rounded-2xl border border-white/14 bg-black/28 p-3 backdrop-blur-sm shadow-[0_6px_16px_rgba(0,0,0,0.18)] transition-[border-color,box-shadow,filter] duration-200 hover:border-white/22 will-change-transform',
        sizePreset === 'compact' ? 'min-h-[180px] p-2.5' : '',
        sizePreset === 'expanded' ? 'min-h-[280px] p-3.5' : '',
        compactBlur ? 'blur-[6px] saturate-[0.6]' : '',
        isOver ? 'border-white/35' : '',
        isMinimized ? 'min-h-[96px]' : ''
      )}
    >
        <header
          onPointerDownCapture={handleCardPointerDownCapture}
          className="mb-2 flex items-center justify-between border-b border-white/10 pb-2"
        >
          <h2
            className={cn(
              'truncate font-semibold leading-tight text-slate-100',
              sizePreset === 'compact' ? 'text-[clamp(1.05rem,1rem+0.3vw,1.35rem)]' : '',
              sizePreset === 'normal' ? 'text-[clamp(1.2rem,1.05rem+0.5vw,1.7rem)]' : '',
              sizePreset === 'expanded' ? 'text-[clamp(1.35rem,1.1rem+0.7vw,1.95rem)]' : ''
            )}
          >
            {board.title}
          </h2>
          <div className="relative flex items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
            <button
              type="button"
              data-no-card-drag
              onClick={() => onAddBookmark(board.id)}
              className="rounded-md border border-white/10 bg-black/20 p-1 text-slate-300 transition-colors duration-150 hover:border-white/22 hover:text-slate-100"
              aria-label={`Add link to ${board.title}`}
              title="Add link"
            >
              <Link2 size={12} />
            </button>
            <button
              type="button"
              data-no-card-drag
              onClick={() => setIsMenuOpen((current) => !current)}
              className="rounded-md border border-white/10 bg-black/20 p-1 text-slate-300 transition-colors duration-150 hover:border-white/22 hover:text-slate-100"
              aria-label={`Board options for ${board.title}`}
              title="Board options"
            >
              <MoreVertical size={12} />
            </button>

            {isMenuOpen ? (
              <div
                ref={menuRef}
                data-no-card-drag
                className="absolute right-0 top-8 z-20 w-36 rounded-lg border border-white/12 bg-black/75 p-1.5 backdrop-blur-md"
              >
                <button
                  type="button"
                  onClick={() => handleMenuAction(() => onToggleMinimize(board.id))}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-200 transition-colors hover:bg-white/8"
                >
                  {isMinimized ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
                  {isMinimized ? 'Expand' : 'Minimize'}
                </button>
                <button
                  type="button"
                  onPointerDown={(event) => {
                    setIsMenuOpen(false);
                    handleCardDragStart(event);
                  }}
                  disabled={dragDisabled}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-200 transition-colors hover:bg-white/8',
                    dragDisabled ? 'cursor-not-allowed opacity-45' : ''
                  )}
                >
                  <MoveDiagonal2 size={12} />
                  Move
                </button>
                <button
                  type="button"
                  onClick={() => handleMenuAction(() => onToggleBoardPinned(board.id))}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-200 transition-colors hover:bg-white/8"
                >
                  <Pin size={12} />
                  {board.pinned ? 'Unpin board' : 'Pin board'}
                </button>
                <button
                  type="button"
                  onClick={() => handleMenuAction(() => onRenameBoard(board.id))}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-200 transition-colors hover:bg-white/8"
                >
                  <Pencil size={12} />
                  Rename
                </button>

                <div className="my-1 h-px bg-white/10" />
                <p className="px-2 pb-1 text-[10px] uppercase tracking-[0.12em] text-slate-400">Board size</p>
                <button
                  type="button"
                  onClick={() => handleMenuAction(() => onBoardSizeChange(board.id, 'compact'))}
                  className={cn(
                    'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-white/8',
                    sizePreset === 'compact' ? 'text-white' : 'text-slate-200'
                  )}
                >
                  <span>Compact</span>
                  {sizePreset === 'compact' ? <span>✓</span> : null}
                </button>
                <button
                  type="button"
                  onClick={() => handleMenuAction(() => onBoardSizeChange(board.id, 'expanded'))}
                  className={cn(
                    'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-white/8',
                    sizePreset === 'expanded' ? 'text-white' : 'text-slate-200'
                  )}
                >
                  <span>Expanded</span>
                  {sizePreset === 'expanded' ? <span>✓</span> : null}
                </button>
                <button
                  type="button"
                  onClick={() => handleMenuAction(() => onResetBoardSize(board.id))}
                  disabled={sizePreset === 'normal'}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                    sizePreset === 'normal'
                      ? 'cursor-not-allowed text-slate-500'
                      : 'text-slate-200 hover:bg-white/8'
                  )}
                >
                  Reset to normal
                </button>

                <div className="my-1 h-px bg-white/10" />
                <button
                  type="button"
                  onClick={() => handleMenuAction(() => onDeleteBoard(board.id))}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-red-300 transition-colors hover:bg-red-500/15"
                >
                  <Trash2 size={12} />
                  Delete
                </button>
              </div>
            ) : null}
          </div>
        </header>

        {isMinimized ? (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-white/15 bg-black/15 text-xs uppercase tracking-[0.16em] text-slate-400">
            {board.bookmarks.length} links
          </div>
        ) : (
          <SortableContext
            items={board.bookmarks.map((bookmark) => bookmarkDndId(bookmark.id))}
            strategy={verticalListSortingStrategy}
          >
            <div
              className={cn(
                'futuristic-scrollbar flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pr-0.5',
                viewMode === 'compact' ? 'gap-0.5' : 'gap-1'
              )}
            >
              {board.bookmarks.length > 0 ? (
                visibleBookmarks.map((bookmark) => (
                  <LinkItem
                    key={bookmark.id}
                    boardId={board.id}
                    bookmark={bookmark}
                    compactBlur={compactBlur}
                    deleteMode={deleteMode}
                    dragDisabled={dragDisabled}
                    attachmentCount={getBookmarkAttachmentCount(bookmark.url)}
                    onEdit={() => onEditBookmark(board.id, bookmark.id)}
                    onDelete={() => onDeleteBookmark(board.id, bookmark.id)}
                    onToggleFavorite={() => onToggleBookmarkFavorite(board.id, bookmark.id)}
                    onTogglePinned={() => onToggleBookmarkPinned(board.id, bookmark.id)}
                    onAttachToVault={() => onAttachBookmarkToVault(board.id, bookmark.id)}
                    onOpen={() => onOpenBookmark(board.id, bookmark.id)}
                  />
                ))
              ) : (
                <button
                  type="button"
                  onClick={() => onAddBookmark(board.id)}
                  className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-white/15 bg-black/15 text-xs uppercase tracking-[0.16em] text-slate-400 transition-colors hover:border-white/30 hover:text-slate-200"
                >
                  Add first link
                </button>
              )}
              {hiddenBookmarksCount > 0 ? (
                <p className="px-1 pt-1 text-[11px] text-slate-400">+{hiddenBookmarksCount} more</p>
              ) : null}
            </div>
          </SortableContext>
        )}
    </motion.article>
  );
}
