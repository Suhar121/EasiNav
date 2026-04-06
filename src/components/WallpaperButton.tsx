import { useRef } from 'react';
import type { ChangeEvent } from 'react';
import { motion } from 'framer-motion';
import { ImagePlus } from 'lucide-react';

interface WallpaperButtonProps {
  onWallpaperSelected: (file: File) => void;
}

export function WallpaperButton({ onWallpaperSelected }: WallpaperButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const onSelectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      return;
    }

    onWallpaperSelected(selectedFile);
    event.target.value = '';
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onSelectFile}
      />

      <motion.button
        type="button"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => inputRef.current?.click()}
        className="group fixed bottom-5 left-4 z-30 flex h-12 w-12 items-center justify-center rounded-xl border border-white/12 bg-black/30 text-slate-200 backdrop-blur-md transition-colors duration-200 hover:border-white/25 hover:bg-white/10 hover:text-white sm:bottom-7 sm:left-6"
        aria-label="Upload wallpaper"
      >
        <ImagePlus size={18} />
        <span className="pointer-events-none absolute left-[3.7rem] hidden -translate-x-2 whitespace-nowrap rounded-md border border-white/15 bg-black/75 px-2 py-1 text-xs font-medium text-slate-100 opacity-0 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100 lg:block">
          Upload wallpaper
        </span>
      </motion.button>
    </>
  );
}
