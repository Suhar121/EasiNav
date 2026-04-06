import { motion, useDragControls } from 'framer-motion';
import { CirclePlus } from 'lucide-react';
import type { PointerEvent as ReactPointerEvent } from 'react';

interface AddBoardCardProps {
  onClick: () => void;
}

export function AddBoardCard({ onClick }: AddBoardCardProps) {
  const dragControls = useDragControls();

  const handleCardPointerDownCapture = (event: ReactPointerEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('button, a, input, textarea, select, [data-no-card-drag]')) {
      return;
    }

    dragControls.start(event);
  };

  return (
    <motion.article
      drag
      dragElastic={0.01}
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      whileDrag={{ scale: 1.015, zIndex: 90 }}
      onPointerDownCapture={handleCardPointerDownCapture}
      style={{ touchAction: 'none' }}
      className="group relative flex min-h-[220px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-white/22 bg-black/22 p-3 backdrop-blur-sm transition-[border-color,background-color] duration-200 hover:border-white/34 hover:bg-white/7 will-change-transform"
      data-dnd-item="add-board"
    >
      <button
        type="button"
        data-no-card-drag
        onClick={onClick}
        className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6a00]/70"
        aria-label="Add board"
      >
        <CirclePlus size={30} className="text-slate-300 transition-colors duration-200 group-hover:text-slate-100" />
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 group-hover:text-slate-100">
          Add Board
        </span>
      </button>
    </motion.article>
  );
}
