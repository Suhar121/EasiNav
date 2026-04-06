import { motion, useDragControls } from 'framer-motion';
import { Check, Grip, ListTodo, Maximize2, Minimize2, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent, PointerEvent } from 'react';
import type { Position2D, TodoItem } from '../types';
import { cn } from '../utils/cn';

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
        onPositionChange({
          x: position.x + info.offset.x,
          y: position.y + info.offset.y,
        });
      }}
      style={{ x: position.x, y: position.y }}
      className={cn(
        'fixed bottom-4 right-20 z-40 rounded-2xl border border-white/12 bg-black/28 p-3 backdrop-blur-sm shadow-[0_8px_24px_rgba(0,0,0,0.24)] sm:bottom-5 sm:right-[5.25rem]',
        isMinimized ? 'w-[200px]' : 'w-[300px]'
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-100">
          <ListTodo size={14} className="text-slate-300" />
          <h3 className="text-xs font-semibold tracking-wide">Todo</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onPointerDown={handleDragStart}
            className="rounded-md border border-white/12 bg-black/25 p-1 text-slate-300 transition-colors hover:border-white/20 hover:text-slate-100"
            aria-label="Drag todo card"
            title="Drag card"
          >
            <Grip size={13} />
          </button>
          <button
            type="button"
            onClick={onToggleMinimize}
            className="rounded-md border border-white/12 bg-black/25 p-1 text-slate-300 transition-colors hover:border-white/20 hover:text-slate-100"
            aria-label={isMinimized ? 'Expand todo card' : 'Minimize todo card'}
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
          </button>
        </div>
      </div>

      {isMinimized ? (
        <p className="text-[11px] text-slate-300">{pendingCount} pending</p>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between">
            <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] text-slate-300">
              {pendingCount} pending
            </span>
          </div>

          <form onSubmit={handleSubmit} className="mb-2 flex items-center gap-1.5">
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Add a task..."
              className="w-full rounded-md border border-white/12 bg-black/25 px-2.5 py-1.5 text-xs text-slate-100 outline-none transition-colors focus:border-white/25"
            />
            <button
              type="submit"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/12 bg-black/25 text-slate-100 transition-colors hover:border-white/25 hover:text-slate-100"
              aria-label="Add todo"
            >
              <Plus size={14} />
            </button>
          </form>

          <div className="futuristic-scrollbar max-h-44 space-y-1.5 overflow-y-auto pr-0.5">
            {todos.length === 0 ? (
              <p className="rounded-lg border border-dashed border-white/20 py-2.5 text-center text-[11px] text-slate-400">
                No tasks yet
              </p>
            ) : (
              todos.map((todo) => (
                <motion.div
                  key={todo.id}
                  layout
                  className={cn(
                    'flex items-center gap-1.5 rounded-md border border-white/10 bg-black/20 px-2 py-1.5',
                    todo.completed ? 'opacity-70' : ''
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onToggleTodo(todo.id)}
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors',
                      todo.completed
                        ? 'border-white/25 bg-white/80 text-zinc-900'
                        : 'border-white/20 text-slate-400 hover:border-white/30 hover:text-slate-200'
                    )}
                    aria-label={todo.completed ? 'Mark as pending' : 'Mark as done'}
                  >
                    <Check size={13} />
                  </button>

                  <p
                    className={cn(
                      'flex-1 text-xs text-slate-100',
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
