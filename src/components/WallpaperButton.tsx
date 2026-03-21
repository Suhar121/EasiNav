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
        className="group fixed bottom-5 left-4 z-30 flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/10 text-slate-100 backdrop-blur-2xl transition-all duration-300 hover:border-[#ff6a00]/60 hover:bg-[#ff6a00]/25 hover:text-white hover:shadow-[0_0_28px_rgba(255,106,0,0.5)] sm:bottom-7 sm:left-6"
        aria-label="Upload wallpaper"
      >
        <ImagePlus size={21} />
        <span className="pointer-events-none absolute left-[4.2rem] hidden -translate-x-2 whitespace-nowrap rounded-lg border border-white/15 bg-black/80 px-2.5 py-1 text-xs font-medium text-slate-100 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 lg:block">
          Upload wallpaper
        </span>
      </motion.button>
    </>
  );
}
