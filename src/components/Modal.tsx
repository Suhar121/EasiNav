import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ isOpen, title, description, onClose, children }: ModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="mx-auto my-4 flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col rounded-3xl border border-white/15 bg-[#0f1116]/85 p-6 shadow-[0_20px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:my-6 sm:max-h-[calc(100vh-3rem)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">{title}</h2>
                {description ? <p className="mt-1 text-sm text-slate-300">{description}</p> : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-white/15 bg-white/5 p-2 text-slate-200 transition-colors hover:bg-white/10"
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            </div>

            <div className="futuristic-scrollbar min-h-0 overflow-y-auto pr-1">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
