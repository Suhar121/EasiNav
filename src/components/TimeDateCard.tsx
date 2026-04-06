import { motion, useDragControls } from 'framer-motion';
import { CalendarDays, Clock3, Grip, Maximize2, Minimize2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { PointerEvent } from 'react';
import type { Position2D } from '../types';

interface TimeDateCardProps {
  position: Position2D;
  isMinimized: boolean;
  onPositionChange: (nextPosition: Position2D) => void;
  onToggleMinimize: () => void;
}

export function TimeDateCard({
  position,
  isMinimized,
  onPositionChange,
  onToggleMinimize,
}: TimeDateCardProps) {
  const [now, setNow] = useState(() => new Date());
  const dragControls = useDragControls();

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const timeLabel = useMemo(
    () =>
      now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    [now]
  );

  const dayLabel = useMemo(
    () =>
      now.toLocaleDateString([], {
        weekday: 'long',
      }),
    [now]
  );

  const dateLabel = useMemo(
    () =>
      now.toLocaleDateString([], {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
    [now]
  );

  const handleDragStart = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragControls.start(event);
  };

  return (
    <motion.section
      drag
      dragElastic={0.08}
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      whileDrag={{ scale: 1.01, zIndex: 90 }}
      onDragEnd={(_, info) => {
        onPositionChange({
          x: position.x + info.offset.x,
          y: position.y + info.offset.y,
        });
      }}
      style={{ x: position.x, y: position.y }}
      className="fixed right-24 top-24 z-40 w-[240px] rounded-2xl border border-white/12 bg-black/28 p-3 backdrop-blur-sm shadow-[0_8px_24px_rgba(0,0,0,0.24)]"
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-100">
          <Clock3 size={14} className="text-slate-300" />
          <h3 className="text-xs font-semibold tracking-wide">Time</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onPointerDown={handleDragStart}
            className="rounded-md border border-white/12 bg-black/25 p-1 text-slate-300 transition-colors hover:border-white/20 hover:text-slate-100"
            aria-label="Drag time card"
            title="Drag card"
          >
            <Grip size={13} />
          </button>
          <button
            type="button"
            onClick={onToggleMinimize}
            className="rounded-md border border-white/12 bg-black/25 p-1 text-slate-300 transition-colors hover:border-white/20 hover:text-slate-100"
            aria-label={isMinimized ? 'Expand time card' : 'Minimize time card'}
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
          </button>
        </div>
      </div>

      {isMinimized ? (
        <p className="text-sm text-slate-200">{timeLabel}</p>
      ) : (
        <div className="space-y-1.5">
          <p className="text-2xl font-semibold text-slate-100">{timeLabel}</p>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <CalendarDays size={12} className="text-slate-300" />
            <span>{dayLabel}</span>
          </div>
          <p className="text-sm text-slate-300">{dateLabel}</p>
        </div>
      )}
    </motion.section>
  );
}
