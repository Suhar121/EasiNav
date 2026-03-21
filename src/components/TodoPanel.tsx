import { motion, useDragControls } from 'framer-motion';
import { Check, Grip, ListTodo, Maximize2, Minimize2, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent, PointerEvent } from 'react';
import type { Position2D, TodoItem } from '../types';
import { cn } from '../utils/cn';

const DRAG_COMMIT_DISTANCE_PX = 6;

interface TodoPanelProps {
  todos: TodoItem[];
  position: Position2D;
  isMinimized: boolean;
  onPositionChange: (nextPosition: Position2D) => void;
  onToggleMinimize: () => void;
  onAddTodo: (text: string) => void;
  onToggleTodo: (todoId: string) => void;
  onDeleteTodo: (todoId: string) => void;
}

export function TodoPanel({
  todos,
  position,
  isMinimized,
  onPositionChange,
  onToggleMinimize,
  onAddTodo,
  onToggleTodo,
  onDeleteTodo,
}: TodoPanelProps) {
  const [text, setText] = useState('');
  const dragControls = useDragControls();

  const pendingCount = todos.filter((todo) => !todo.completed).length;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }

    onAddTodo(trimmed);
    setText('');
  };

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
        if (
          Math.abs(info.offset.x) < DRAG_COMMIT_DISTANCE_PX &&
          Math.abs(info.offset.y) < DRAG_COMMIT_DISTANCE_PX
        ) {
          return;
        }

        onPositionChange({
          x: position.x + info.offset.x,
          y: position.y + info.offset.y,
        });
      }}
      style={{ x: position.x, y: position.y }}
      className={cn(
        'fixed bottom-5 right-20 z-40 rounded-3xl border border-white/15 bg-black/45 p-4 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.4)] sm:bottom-6 sm:right-[5.5rem]',
        isMinimized ? 'w-[220px]' : 'w-[300px]'
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-100">
          <ListTodo size={16} className="text-[#ff9b58]" />
          <h3 className="text-sm font-semibold tracking-wide">Todo List</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onPointerDown={handleDragStart}
            className="rounded-md border border-white/15 bg-white/5 p-1 text-slate-300 transition-colors hover:text-white"
            aria-label="Drag todo card"
            title="Drag card"
          >
            <Grip size={13} />
          </button>
          <button
            type="button"
            onClick={onToggleMinimize}
            className="rounded-md border border-white/15 bg-white/5 p-1 text-slate-300 transition-colors hover:text-white"
            aria-label={isMinimized ? 'Expand todo card' : 'Minimize todo card'}
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
          </button>
        </div>
      </div>

      {isMinimized ? (
        <p className="text-xs text-slate-300">{pendingCount} pending tasks</p>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-xs text-slate-300">
              {pendingCount} pending
            </span>
          </div>

          <form onSubmit={handleSubmit} className="mb-3 flex items-center gap-2">
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Add a task..."
              className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-[#ff6a00]/60"
            />
            <button
              type="submit"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-slate-100 transition-all hover:border-[#ff6a00]/60 hover:text-[#ff9b58]"
              aria-label="Add todo"
            >
              <Plus size={14} />
            </button>
          </form>

          <div className="futuristic-scrollbar max-h-44 space-y-2 overflow-y-auto pr-1">
            {todos.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/20 py-3 text-center text-xs text-slate-400">
                No tasks yet
              </p>
            ) : (
              todos.map((todo) => (
                <motion.div
                  key={todo.id}
                  layout
                  className={cn(
                    'flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2.5 py-2',
                    todo.completed ? 'opacity-70' : ''
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onToggleTodo(todo.id)}
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors',
                      todo.completed
                        ? 'border-[#ff6a00]/70 bg-[#ff6a00] text-black'
                        : 'border-white/20 text-slate-400 hover:border-[#ff6a00]/50 hover:text-[#ff9b58]'
                    )}
                    aria-label={todo.completed ? 'Mark as pending' : 'Mark as done'}
                  >
                    <Check size={13} />
                  </button>

                  <p
                    className={cn(
                      'flex-1 text-sm text-slate-100',
                      todo.completed ? 'line-through text-slate-400' : ''
                    )}
                  >
                    {todo.text}
                  </p>

                  <button
                    type="button"
                    onClick={() => onDeleteTodo(todo.id)}
                    className="rounded-md p-1 text-slate-500 transition-colors hover:text-red-300"
                    aria-label="Delete todo"
                  >
                    <Trash2 size={13} />
                  </button>
                </motion.div>
              ))
            )}
          </div>
        </>
      )}
    </motion.section>
  );
}
