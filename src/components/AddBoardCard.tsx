import { motion } from 'framer-motion';
import { CirclePlus } from 'lucide-react';

interface AddBoardCardProps {
  onClick: () => void;
}

export function AddBoardCard({ onClick }: AddBoardCardProps) {
  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.04, y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.18 }}
      onClick={onClick}
      className="group flex min-h-[220px] w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-white/28 bg-black/20 p-6 backdrop-blur-xl transition-all duration-300 hover:border-[#ff6a00]/70 hover:bg-[#ff6a00]/10 hover:shadow-[0_0_50px_rgba(255,106,0,0.35)]"
      data-dnd-item="add-board"
      aria-label="Add board"
    >
      <CirclePlus
        size={34}
        className="text-slate-200/95 transition-all duration-300 group-hover:text-[#ff8f3f] group-hover:drop-shadow-[0_0_14px_rgba(255,106,0,0.75)]"
      />
      <span className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-100/90 group-hover:text-[#ff9b58]">
        Add Board
      </span>
    </motion.button>
  );
}
