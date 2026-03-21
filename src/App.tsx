import {
  closestCenter,
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { motion } from 'framer-motion';
import {
  Download,
  FileUp,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Upload,
  Volume2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { AddBoardCard } from './components/AddBoardCard';
import { Board } from './components/Board';
import { FloatingActions } from './components/FloatingActions';
import { Modal } from './components/Modal';
import { TimeDateCard } from './components/TimeDateCard';
import { TodoPanel } from './components/TodoPanel';
import { TopNav } from './components/TopNav';
import { WallpaperButton } from './components/WallpaperButton';
import type {
  AppData,
  AmbientSoundPreset,
  BoardType,
  Bookmark,
  FilterMode,
  PageType,
  Position2D,
  QuickSavedLink,
  TodoItem,
  ViewMode,
} from './types';
import { AMBIENT_SOUND_PRESETS, createAmbientSoundGraph } from './utils/ambientAudio';
import { cn } from './utils/cn';
import { extractBoardId, extractBookmarkId, isBoardDndId, isBookmarkDndId } from './utils/dnd';
import { getFromStorage, setInStorage, subscribeToStorageKey } from './utils/storage';

const APP_STORAGE_KEY = 'easinav.app-data.v1';
const QUICK_SAVE_STORAGE_KEY = 'savedLinks';
const QUICK_SAVE_BOARD_ID = 'quick-save-inbox';
const DEFAULT_WALLPAPER =
  'https://images.unsplash.com/photo-1620121692029-d088224ddc74?q=80&w=2400&auto=format&fit=crop';
const WALLPAPER_LIBRARY = [
  {
    id: 'futuristic-hall',
    name: 'Neon Corridor',
    url: DEFAULT_WALLPAPER,
  },
  {
    id: 'cyber-city',
    name: 'Cyber City',
    url: 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?q=80&w=2400&auto=format&fit=crop',
  },
  {
    id: 'night-architecture',
    name: 'Night Structure',
    url: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?q=80&w=2400&auto=format&fit=crop',
  },
  {
    id: 'dark-grid',
    name: 'Dark Grid',
    url: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=2400&auto=format&fit=crop',
  },
  {
    id: 'orange-glow',
    name: 'Orange Glow',
    url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=2400&auto=format&fit=crop',
  },
  {
    id: 'minimal-night',
    name: 'Minimal Night',
    url: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?q=80&w=2400&auto=format&fit=crop',
  },
] as const;

type EditorState =
  | { type: 'create-page' }
  | { type: 'rename-page'; pageId: string }
  | { type: 'create-board' }
  | { type: 'rename-board'; boardId: string }
  | { type: 'create-bookmark'; boardId: string }
  | { type: 'edit-bookmark'; boardId: string; bookmarkId: string };

const createId = (prefix: string) => {
  const fallback = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const uuid = globalThis.crypto?.randomUUID?.() ?? fallback;
  return `${prefix}-${uuid}`;
};

const nowIso = () => new Date().toISOString();
const DEFAULT_TODO_POSITION: Position2D = { x: 0, y: 0 };
const DEFAULT_CLOCK_POSITION: Position2D = { x: 0, y: 0 };
const DEFAULT_SOUND_PRESET: AmbientSoundPreset = 'off';
const DEFAULT_SOUND_VOLUME = 0.35;

const SOUND_LABELS: Record<AmbientSoundPreset, string> = {
  off: 'Off',
  rain: 'Rain',
  thunderstorm: 'Thunderstorm',
  ocean: 'Ocean',
  wind: 'Wind',
};

const getFaviconForUrl = (url: string): string | undefined => {
  try {
    const hostname = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
  } catch {
    return undefined;
  }
};

const normalizeUrl = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('URL is required');
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return new URL(withProtocol).toString();
};

const createBookmark = (title: string, url: string, favorite = false, id?: string): Bookmark => ({
  id: id ?? createId('bookmark'),
  title,
  url,
  icon: getFaviconForUrl(url),
  favorite,
  createdAt: nowIso(),
  updatedAt: nowIso(),
});

const createTodo = (text: string, id?: string): TodoItem => ({
  id: id ?? createId('todo'),
  text,
  completed: false,
  createdAt: nowIso(),
});

const buildInitialPages = (): PageType[] => [
  {
    id: 'home',
    title: 'Home',
    boards: [
      {
        id: 'ai',
        title: 'AI',
        bookmarks: [
          createBookmark('ChatGPT', 'https://chat.openai.com', true, 'chatgpt'),
          createBookmark('Claude', 'https://claude.ai', false, 'claude'),
          createBookmark('Perplexity', 'https://www.perplexity.ai', false, 'perplexity'),
        ],
      },
      {
        id: 'code',
        title: 'Code',
        bookmarks: [
          createBookmark('GitHub', 'https://github.com', true, 'github'),
          createBookmark('Vercel', 'https://vercel.com', false, 'vercel'),
          createBookmark('Google Cloud Console', 'https://console.cloud.google.com', false, 'cloud-console'),
        ],
      },
    ],
  },
  {
    id: 'work',
    title: 'Work',
    boards: [
      {
        id: 'ops',
        title: 'Operations',
        bookmarks: [
          createBookmark('Notion Workspace', 'https://www.notion.so', false, 'notion'),
          createBookmark('Slack', 'https://slack.com', false, 'slack'),
        ],
      },
      {
        id: 'meetings',
        title: 'Meetings',
        bookmarks: [
          createBookmark('Google Calendar', 'https://calendar.google.com', false, 'calendar'),
          createBookmark('Google Meet', 'https://meet.google.com', false, 'meet'),
        ],
      },
    ],
  },
];

const buildInitialTodos = (): TodoItem[] => [
  createTodo('Plan top 3 priorities'),
  createTodo('Capture useful links from today'),
  createTodo('Review bookmarks before shutdown'),
];

const createDefaultAppData = (): AppData => {
  const pages = buildInitialPages();
  return {
    pages,
    activePageId: pages[0]?.id ?? '',
    wallpaper: DEFAULT_WALLPAPER,
    layoutMode: 'grid',
    viewMode: 'comfortable',
    filterMode: 'all',
    isIncognito: false,
    todos: buildInitialTodos(),
    boardPositions: {},
    minimizedBoardIds: [],
    todoPosition: DEFAULT_TODO_POSITION,
    clockPosition: DEFAULT_CLOCK_POSITION,
    isTodoMinimized: false,
    isClockMinimized: false,
    soundPreset: DEFAULT_SOUND_PRESET,
    soundVolume: DEFAULT_SOUND_VOLUME,
    isSoundEnabled: false,
  };
};

const sanitizeBookmark = (raw: unknown): Bookmark | null => {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const candidate = raw as Partial<Bookmark>;
  if (typeof candidate.url !== 'string') {
    return null;
  }

  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeUrl(candidate.url);
  } catch {
    return null;
  }

  return {
    id: typeof candidate.id === 'string' && candidate.id ? candidate.id : createId('bookmark'),
    title:
      typeof candidate.title === 'string' && candidate.title.trim() ? candidate.title.trim() : 'Untitled link',
    url: normalizedUrl,
    icon:
      typeof candidate.icon === 'string' && candidate.icon.trim()
        ? candidate.icon
        : getFaviconForUrl(normalizedUrl),
    favorite: Boolean(candidate.favorite),
    createdAt:
      typeof candidate.createdAt === 'string' && candidate.createdAt ? candidate.createdAt : nowIso(),
    updatedAt:
      typeof candidate.updatedAt === 'string' && candidate.updatedAt ? candidate.updatedAt : nowIso(),
  };
};

const sanitizeBoard = (raw: unknown): BoardType | null => {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const candidate = raw as Partial<BoardType>;
  const bookmarks = Array.isArray(candidate.bookmarks)
    ? candidate.bookmarks.map(sanitizeBookmark).filter((bookmark): bookmark is Bookmark => bookmark !== null)
    : [];

  return {
    id: typeof candidate.id === 'string' && candidate.id ? candidate.id : createId('board'),
    title:
      typeof candidate.title === 'string' && candidate.title.trim()
        ? candidate.title.trim()
        : `Board ${Math.floor(Math.random() * 100)}`,
    bookmarks,
  };
};

const sanitizePages = (raw: unknown): PageType[] => {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((pageCandidate): PageType | null => {
      if (!pageCandidate || typeof pageCandidate !== 'object') {
        return null;
      }

      const page = pageCandidate as Partial<PageType>;
      const boards = Array.isArray(page.boards)
        ? page.boards.map(sanitizeBoard).filter((board): board is BoardType => board !== null)
        : [];

      return {
        id: typeof page.id === 'string' && page.id ? page.id : createId('page'),
        title:
          typeof page.title === 'string' && page.title.trim()
            ? page.title.trim()
            : `Space ${Math.floor(Math.random() * 100)}`,
        boards,
      };
    })
    .filter((page): page is PageType => page !== null);
};

const sanitizeTodos = (raw: unknown): TodoItem[] => {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item): TodoItem | null => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const candidate = item as Partial<TodoItem>;
      if (typeof candidate.text !== 'string' || !candidate.text.trim()) {
        return null;
      }

      return {
        id: typeof candidate.id === 'string' && candidate.id ? candidate.id : createId('todo'),
        text: candidate.text.trim(),
        completed: Boolean(candidate.completed),
        createdAt:
          typeof candidate.createdAt === 'string' && candidate.createdAt
            ? candidate.createdAt
            : nowIso(),
      };
    })
    .filter((todo): todo is TodoItem => todo !== null);
};

const sanitizePosition = (raw: unknown, fallback: Position2D): Position2D => {
  if (!raw || typeof raw !== 'object') {
    return fallback;
  }

  const candidate = raw as Partial<Position2D>;
  return {
    x: Number.isFinite(candidate.x) ? Number(candidate.x) : fallback.x,
    y: Number.isFinite(candidate.y) ? Number(candidate.y) : fallback.y,
  };
};

const sanitizeBoardPositions = (raw: unknown): Record<string, Position2D> => {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const entries = Object.entries(raw as Record<string, unknown>)
    .map(([boardId, position]) => [boardId, sanitizePosition(position, { x: 0, y: 0 })] as const);
  return Object.fromEntries(entries);
};

const sanitizeSoundPreset = (raw: unknown): AmbientSoundPreset =>
  AMBIENT_SOUND_PRESETS.includes(raw as AmbientSoundPreset)
    ? (raw as AmbientSoundPreset)
    : DEFAULT_SOUND_PRESET;

const sanitizeSoundVolume = (raw: unknown): number => {
  if (typeof raw !== 'number' || Number.isNaN(raw)) {
    return DEFAULT_SOUND_VOLUME;
  }

  return Math.min(1, Math.max(0, raw));
};

const sanitizeAppData = (raw: unknown): AppData | null => {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const candidate = raw as Partial<AppData>;
  const pages = sanitizePages(candidate.pages);
  if (!pages.length) {
    return null;
  }

  const activePageId =
    typeof candidate.activePageId === 'string' && pages.some((page) => page.id === candidate.activePageId)
      ? candidate.activePageId
      : pages[0].id;

  const filterMode: FilterMode = candidate.filterMode === 'favorites' ? 'favorites' : 'all';
  const viewMode: ViewMode = candidate.viewMode === 'compact' ? 'compact' : 'comfortable';
  const todos = sanitizeTodos(candidate.todos);
  const boardPositions = sanitizeBoardPositions(candidate.boardPositions);
  const soundPreset = sanitizeSoundPreset(candidate.soundPreset);
  const soundVolume = sanitizeSoundVolume(candidate.soundVolume);
  const minimizedBoardIds = Array.isArray(candidate.minimizedBoardIds)
    ? candidate.minimizedBoardIds.filter((item): item is string => typeof item === 'string')
    : [];

  return {
    pages,
    activePageId,
    wallpaper:
      typeof candidate.wallpaper === 'string' && candidate.wallpaper.trim()
        ? candidate.wallpaper
        : DEFAULT_WALLPAPER,
    layoutMode: candidate.layoutMode === 'list' ? 'list' : 'grid',
    viewMode,
    filterMode,
    isIncognito: Boolean(candidate.isIncognito),
    todos: todos.length ? todos : buildInitialTodos(),
    boardPositions,
    minimizedBoardIds,
    todoPosition: sanitizePosition(candidate.todoPosition, DEFAULT_TODO_POSITION),
    clockPosition: sanitizePosition(candidate.clockPosition, DEFAULT_CLOCK_POSITION),
    isTodoMinimized: Boolean(candidate.isTodoMinimized),
    isClockMinimized: Boolean(candidate.isClockMinimized),
    soundPreset,
    soundVolume,
    isSoundEnabled: soundPreset !== 'off' && Boolean(candidate.isSoundEnabled),
  };
};

const mergeQuickSavedLinks = (pages: PageType[], pendingLinks: QuickSavedLink[]): PageType[] => {
  if (!pendingLinks.length) {
    return pages;
  }

  const validLinks = pendingLinks
    .map((entry) => {
      if (!entry?.url) {
        return null;
      }

      try {
        const normalizedUrl = normalizeUrl(entry.url);
        const title =
          typeof entry.title === 'string' && entry.title.trim()
            ? entry.title.trim()
            : new URL(normalizedUrl).hostname;
        return createBookmark(title, normalizedUrl, false, entry.id);
      } catch {
        return null;
      }
    })
    .filter((bookmark): bookmark is Bookmark => bookmark !== null);

  if (!validLinks.length) {
    return pages;
  }

  const nextPages = pages.length ? [...pages] : buildInitialPages();
  const targetPage = { ...nextPages[0], boards: [...nextPages[0].boards] };
  nextPages[0] = targetPage;

  const existingBoardIndex = targetPage.boards.findIndex((board) => board.id === QUICK_SAVE_BOARD_ID);
  const existingBoard =
    existingBoardIndex >= 0
      ? { ...targetPage.boards[existingBoardIndex], bookmarks: [...targetPage.boards[existingBoardIndex].bookmarks] }
      : {
          id: QUICK_SAVE_BOARD_ID,
          title: 'Quick Saves',
          bookmarks: [] as Bookmark[],
        };

  const knownUrls = new Set(existingBoard.bookmarks.map((bookmark) => bookmark.url));
  const uniqueNewLinks = validLinks.filter((bookmark) => !knownUrls.has(bookmark.url));

  if (!uniqueNewLinks.length) {
    return nextPages;
  }

  existingBoard.bookmarks = [...uniqueNewLinks, ...existingBoard.bookmarks];

  if (existingBoardIndex >= 0) {
    targetPage.boards[existingBoardIndex] = existingBoard;
  } else {
    targetPage.boards = [existingBoard, ...targetPage.boards];
  }

  return nextPages;
};

interface BookmarkApiNode {
  title?: string;
  url?: string;
  children?: BookmarkApiNode[];
}

const convertChromeBookmarksToBoards = (
  nodes: BookmarkApiNode[],
  maxBoards = 10
): BoardType[] => {
  const grouped = new Map<string, Bookmark[]>();

  const visit = (node: BookmarkApiNode, path: string[]) => {
    if (node.url) {
      try {
        const normalizedUrl = normalizeUrl(node.url);
        const title = node.title?.trim() || new URL(normalizedUrl).hostname;
        const topFolder = path.find((segment) => segment.trim()) || 'Imported';
        const list = grouped.get(topFolder) ?? [];
        list.push(createBookmark(title, normalizedUrl));
        grouped.set(topFolder, list);
      } catch {
        return;
      }
      return;
    }

    if (!node.children?.length) {
      return;
    }

    const nextPath = node.title?.trim() ? [...path, node.title.trim()] : path;
    node.children.forEach((child) => visit(child, nextPath));
  };

  nodes.forEach((node) => visit(node, []));

  return Array.from(grouped.entries())
    .slice(0, maxBoards)
    .map(([title, bookmarks]) => {
      const uniqueByUrl = new Map(bookmarks.map((bookmark) => [bookmark.url, bookmark]));
      return {
        id: createId('import-board'),
        title: title || 'Imported',
        bookmarks: Array.from(uniqueByUrl.values()).slice(0, 80),
      };
    })
    .filter((board) => board.bookmarks.length > 0);
};

function App() {
  const defaultData = useMemo(() => createDefaultAppData(), []);

  const [pages, setPages] = useState<PageType[]>(defaultData.pages);
  const [activePageId, setActivePageId] = useState(defaultData.activePageId);
  const [wallpaper, setWallpaper] = useState(defaultData.wallpaper);
  const [layoutMode, setLayoutMode] = useState<AppData['layoutMode']>(defaultData.layoutMode);
  const [viewMode, setViewMode] = useState<ViewMode>(defaultData.viewMode);
  const [filterMode, setFilterMode] = useState<FilterMode>(defaultData.filterMode);
  const [isIncognito, setIsIncognito] = useState(defaultData.isIncognito);
  const [todos, setTodos] = useState<TodoItem[]>(defaultData.todos);
  const [boardPositions, setBoardPositions] = useState<Record<string, Position2D>>(
    defaultData.boardPositions
  );
  const [minimizedBoardIds, setMinimizedBoardIds] = useState<string[]>(defaultData.minimizedBoardIds);
  const [todoPosition, setTodoPosition] = useState<Position2D>(defaultData.todoPosition);
  const [clockPosition, setClockPosition] = useState<Position2D>(defaultData.clockPosition);
  const [isTodoMinimized, setIsTodoMinimized] = useState(defaultData.isTodoMinimized);
  const [isClockMinimized, setIsClockMinimized] = useState(defaultData.isClockMinimized);
  const [soundPreset, setSoundPreset] = useState<AmbientSoundPreset>(defaultData.soundPreset);
  const [soundVolume, setSoundVolume] = useState(defaultData.soundVolume);
  const [isSoundEnabled, setIsSoundEnabled] = useState(defaultData.isSoundEnabled);

  const [isHydrated, setIsHydrated] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [activeDragLabel, setActiveDragLabel] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const isApplyingExternalStorageRef = useRef(false);
  const lastPersistedSnapshotRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const stopAmbientSoundRef = useRef<(() => void) | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const activePage = useMemo(
    () => pages.find((page) => page.id === activePageId) ?? pages[0],
    [pages, activePageId]
  );

  useEffect(() => {
    if (!activePage && pages.length > 0) {
      setActivePageId(pages[0].id);
    }
  }, [activePage, pages]);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const stored = await getFromStorage<AppData>(APP_STORAGE_KEY);
      const pendingQuickSaves = (await getFromStorage<QuickSavedLink[]>(QUICK_SAVE_STORAGE_KEY)) ?? [];

      const restored = sanitizeAppData(stored) ?? createDefaultAppData();
      const pagesWithQuickSaves = mergeQuickSavedLinks(restored.pages, pendingQuickSaves);

      if (pendingQuickSaves.length > 0) {
        await setInStorage(QUICK_SAVE_STORAGE_KEY, []);
      }

      if (cancelled) {
        return;
      }

      setPages(pagesWithQuickSaves);
      setActivePageId(
        pagesWithQuickSaves.some((page) => page.id === restored.activePageId)
          ? restored.activePageId
          : pagesWithQuickSaves[0].id
      );
      setWallpaper(restored.wallpaper);
      setLayoutMode(restored.layoutMode);
      setViewMode(restored.viewMode);
      setFilterMode(restored.filterMode);
      setIsIncognito(restored.isIncognito);
      setTodos(restored.todos);
      setBoardPositions(restored.boardPositions);
      setMinimizedBoardIds(restored.minimizedBoardIds);
      setTodoPosition(restored.todoPosition);
      setClockPosition(restored.clockPosition);
      setIsTodoMinimized(restored.isTodoMinimized);
      setIsClockMinimized(restored.isClockMinimized);
      setSoundPreset(restored.soundPreset);
      setSoundVolume(restored.soundVolume);
      setIsSoundEnabled(restored.isSoundEnabled && restored.soundPreset !== 'off');
      setIsHydrated(true);

      if (pendingQuickSaves.length > 0) {
        setToast(
          `${pendingQuickSaves.length} quick-saved ${
            pendingQuickSaves.length > 1 ? 'links' : 'link'
          } moved to Quick Saves`
        );
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToStorageKey<AppData>(APP_STORAGE_KEY, (nextValue) => {
      const restored = sanitizeAppData(nextValue);
      if (!restored) {
        return;
      }

      const snapshot = JSON.stringify(restored);
      if (snapshot === lastPersistedSnapshotRef.current) {
        return;
      }

      isApplyingExternalStorageRef.current = true;
      lastPersistedSnapshotRef.current = snapshot;

      setPages(restored.pages);
      setActivePageId(restored.activePageId);
      setWallpaper(restored.wallpaper);
      setLayoutMode(restored.layoutMode);
      setViewMode(restored.viewMode);
      setFilterMode(restored.filterMode);
      setIsIncognito(restored.isIncognito);
      setTodos(restored.todos);
      setBoardPositions(restored.boardPositions);
      setMinimizedBoardIds(restored.minimizedBoardIds);
      setTodoPosition(restored.todoPosition);
      setClockPosition(restored.clockPosition);
      setIsTodoMinimized(restored.isTodoMinimized);
      setIsClockMinimized(restored.isClockMinimized);
      setSoundPreset(restored.soundPreset);
      setSoundVolume(restored.soundVolume);
      setIsSoundEnabled(restored.isSoundEnabled && restored.soundPreset !== 'off');
      setIsHydrated(true);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (isApplyingExternalStorageRef.current) {
      isApplyingExternalStorageRef.current = false;
      return;
    }

    const payload: AppData = {
      pages,
      activePageId,
      wallpaper,
      layoutMode,
      viewMode,
      filterMode,
      isIncognito,
      todos,
      boardPositions,
      minimizedBoardIds,
      todoPosition,
      clockPosition,
      isTodoMinimized,
      isClockMinimized,
      soundPreset,
      soundVolume,
      isSoundEnabled,
    };

    lastPersistedSnapshotRef.current = JSON.stringify(payload);
    void setInStorage(APP_STORAGE_KEY, payload);
  }, [
    activePageId,
    boardPositions,
    clockPosition,
    filterMode,
    isClockMinimized,
    isHydrated,
    isIncognito,
    isSoundEnabled,
    isTodoMinimized,
    layoutMode,
    minimizedBoardIds,
    pages,
    soundPreset,
    soundVolume,
    todoPosition,
    todos,
    viewMode,
    wallpaper,
  ]);

  useEffect(() => {
    if (!isSearchOpen) {
      return;
    }

    searchInputRef.current?.focus();
  }, [isSearchOpen]);

  useEffect(() => {
    if (isIncognito && viewMode !== 'compact') {
      setViewMode('compact');
    }
  }, [isIncognito, viewMode]);

  useEffect(() => {
    if (soundPreset === 'off' && isSoundEnabled) {
      setIsSoundEnabled(false);
    }
  }, [isSoundEnabled, soundPreset]);

  useEffect(() => {
    if (!isSoundEnabled || soundPreset === 'off') {
      stopAmbientSoundRef.current?.();
      stopAmbientSoundRef.current = null;
      if (masterGainRef.current && audioContextRef.current) {
        masterGainRef.current.gain.setTargetAtTime(0, audioContextRef.current.currentTime, 0.08);
      }
      return;
    }

    const AudioContextCtor = (
      globalThis as {
        AudioContext?: typeof AudioContext;
        webkitAudioContext?: typeof AudioContext;
      }
    ).AudioContext ??
      (
        globalThis as {
          AudioContext?: typeof AudioContext;
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;

    if (!AudioContextCtor) {
      setToast('Ambient audio is not supported in this browser context');
      return;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextCtor();
    }

    const audioContext = audioContextRef.current;
    if (audioContext.state === 'suspended') {
      void audioContext.resume();
    }

    if (!masterGainRef.current) {
      masterGainRef.current = audioContext.createGain();
      masterGainRef.current.gain.value = 0;
      masterGainRef.current.connect(audioContext.destination);
    }

    const masterGain = masterGainRef.current;

    stopAmbientSoundRef.current?.();
    stopAmbientSoundRef.current = createAmbientSoundGraph(audioContext, masterGain, soundPreset);
    masterGain.gain.setTargetAtTime(soundVolume, audioContext.currentTime, 0.1);

    return () => {
      stopAmbientSoundRef.current?.();
      stopAmbientSoundRef.current = null;
    };
  }, [isSoundEnabled, soundPreset, soundVolume]);

  useEffect(() => {
    return () => {
      stopAmbientSoundRef.current?.();
      stopAmbientSoundRef.current = null;

      const gain = masterGainRef.current;
      if (gain) {
        gain.disconnect();
        masterGainRef.current = null;
      }

      if (audioContextRef.current) {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const visibleBoards = useMemo(() => {
    if (!activePage) {
      return [];
    }

    const query = searchQuery.trim().toLowerCase();

    return activePage.boards
      .map((board) => {
        const boardBookmarks =
          filterMode === 'favorites'
            ? board.bookmarks.filter((bookmark) => bookmark.favorite)
            : board.bookmarks;

        if (!query) {
          return { ...board, bookmarks: boardBookmarks };
        }

        const boardTitleMatch = board.title.toLowerCase().includes(query);
        const matchingBookmarks = boardTitleMatch
          ? boardBookmarks
          : boardBookmarks.filter((bookmark) =>
              `${bookmark.title} ${bookmark.url}`.toLowerCase().includes(query)
            );

        return { ...board, bookmarks: matchingBookmarks };
      })
      .filter((board) => {
        if (!query) {
          return true;
        }

        return (
          board.title.toLowerCase().includes(query) ||
          board.bookmarks.some((bookmark) =>
            `${bookmark.title} ${bookmark.url}`.toLowerCase().includes(query)
          )
        );
      });
  }, [activePage, filterMode, searchQuery]);

  const totalBoards = activePage?.boards.length ?? 0;
  const totalLinks = useMemo(
    () => activePage?.boards.reduce((count, board) => count + board.bookmarks.length, 0) ?? 0,
    [activePage]
  );
  const visibleLinks = useMemo(
    () => visibleBoards.reduce((count, board) => count + board.bookmarks.length, 0),
    [visibleBoards]
  );

  const dragDisabled = Boolean(searchQuery.trim()) || filterMode === 'favorites';
  const compactBlur = viewMode === 'compact';

  const getBoardPosition = (boardId: string): Position2D => boardPositions[boardId] ?? { x: 0, y: 0 };
  const isBoardMinimized = (boardId: string): boolean => minimizedBoardIds.includes(boardId);

  const updateActivePage = (updater: (page: PageType) => PageType) => {
    if (!activePageId) {
      return;
    }

    setPages((currentPages) =>
      currentPages.map((page) => (page.id === activePageId ? updater(page) : page))
    );
  };

  const openEditor = (nextEditor: EditorState, initialTitle = '', initialUrl = '') => {
    setEditor(nextEditor);
    setFormTitle(initialTitle);
    setFormUrl(initialUrl);
    setFormError(null);
  };

  const openCreatePageEditor = () => {
    openEditor({ type: 'create-page' }, `Space ${pages.length + 1}`);
  };

  const openRenamePageEditor = () => {
    if (!activePage) {
      return;
    }
    openEditor({ type: 'rename-page', pageId: activePage.id }, activePage.title);
  };

  const openCreateBoardEditor = () => {
    openEditor({ type: 'create-board' }, `Board ${totalBoards + 1}`);
  };

  const openRenameBoardEditor = (boardId: string) => {
    const board = activePage?.boards.find((item) => item.id === boardId);
    if (!board) {
      return;
    }
    openEditor({ type: 'rename-board', boardId }, board.title);
  };

  const openCreateBookmarkEditor = (boardId: string) => {
    openEditor({ type: 'create-bookmark', boardId }, '', '');
  };

  const handleQuickLink = () => {
    const targetBoardId = activePage?.boards[0]?.id;
    if (targetBoardId) {
      openCreateBookmarkEditor(targetBoardId);
      return;
    }

    openCreateBoardEditor();
    setToast('Create a board first, then add links');
  };

  const openEditBookmarkEditor = (boardId: string, bookmarkId: string) => {
    const board = activePage?.boards.find((item) => item.id === boardId);
    const bookmark = board?.bookmarks.find((item) => item.id === bookmarkId);
    if (!bookmark) {
      return;
    }

    openEditor({ type: 'edit-bookmark', boardId, bookmarkId }, bookmark.title, bookmark.url);
  };

  const closeEditor = () => {
    setEditor(null);
    setFormTitle('');
    setFormUrl('');
    setFormError(null);
  };

  const handleDeleteActivePage = () => {
    if (!activePage || pages.length <= 1) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${activePage.title}" and all its boards/links? This action cannot be undone.`
    );
    if (!confirmed) {
      return;
    }

    setPages((currentPages) => {
      const nextPages = currentPages.filter((page) => page.id !== activePage.id);
      const nextActive = nextPages[0]?.id ?? '';
      setActivePageId(nextActive);
      return nextPages;
    });

    setToast('Page deleted');
  };

  const handleDeleteBoard = (boardId: string) => {
    if (!activePage) {
      return;
    }

    const board = activePage.boards.find((item) => item.id === boardId);
    if (!board) {
      return;
    }

    const confirmed = window.confirm(
      `Delete board "${board.title}" and ${board.bookmarks.length} link${
        board.bookmarks.length === 1 ? '' : 's'
      }?`
    );
    if (!confirmed) {
      return;
    }

    updateActivePage((page) => ({
      ...page,
      boards: page.boards.filter((boardItem) => boardItem.id !== boardId),
    }));
    setBoardPositions((current) => {
      const next = { ...current };
      delete next[boardId];
      return next;
    });
    setMinimizedBoardIds((current) => current.filter((id) => id !== boardId));
    setToast(`Deleted board "${board.title}"`);
  };

  const handleDeleteBookmark = (boardId: string, bookmarkId: string) => {
    const board = activePage?.boards.find((boardItem) => boardItem.id === boardId);
    const bookmark = board?.bookmarks.find((bookmarkItem) => bookmarkItem.id === bookmarkId);
    if (!bookmark) {
      return;
    }

    if (!isDeleteMode) {
      const confirmed = window.confirm(`Delete link "${bookmark.title}"?`);
      if (!confirmed) {
        return;
      }
    }

    updateActivePage((page) => ({
      ...page,
      boards: page.boards.map((boardItem) =>
        boardItem.id !== boardId
          ? boardItem
          : {
              ...boardItem,
              bookmarks: boardItem.bookmarks.filter((bookmarkItem) => bookmarkItem.id !== bookmarkId),
            }
      ),
    }));
    setToast(`Deleted "${bookmark.title}"`);
  };

  const handleToggleBookmarkFavorite = (boardId: string, bookmarkId: string) => {
    updateActivePage((page) => ({
      ...page,
      boards: page.boards.map((boardItem) =>
        boardItem.id !== boardId
          ? boardItem
          : {
              ...boardItem,
              bookmarks: boardItem.bookmarks.map((bookmark) =>
                bookmark.id !== bookmarkId
                  ? bookmark
                  : {
                      ...bookmark,
                      favorite: !bookmark.favorite,
                      updatedAt: nowIso(),
                    }
              ),
            }
      ),
    }));
  };

  const openIncognitoWindow = (): boolean => {
    const chromeApi = (
      globalThis as {
        chrome?: {
          windows?: {
            create?: (
              createData: { incognito?: boolean; url?: string },
              callback?: () => void
            ) => void;
          };
          runtime?: {
            lastError?: {
              message?: string;
            };
          };
        };
      }
    ).chrome;

    const targetUrl = globalThis.location?.href ?? 'about:blank';

    if (chromeApi?.windows?.create) {
      chromeApi.windows.create({ incognito: true, url: targetUrl }, () => {
        if (chromeApi.runtime?.lastError) {
          setToast('Unable to open incognito tab. Enable extension in incognito settings.');
        }
      });
      return true;
    }

    const popup = globalThis.open?.(targetUrl, '_blank', 'noopener,noreferrer');
    return Boolean(popup);
  };

  const handleToggleIncognito = () => {
    const next = !isIncognito;
    setIsIncognito(next);

    if (next) {
      setViewMode('compact');
      const opened = openIncognitoWindow();
      setToast(opened ? 'Incognito mode enabled' : 'Incognito mode enabled (popup blocked)');
      return;
    }

    setToast('Incognito mode disabled');
  };

  const handleToggleAmbientSound = () => {
    if (!isSoundEnabled && soundPreset === 'off') {
      setSoundPreset('rain');
      setIsSoundEnabled(true);
      setToast('Ambient sound: Rain');
      return;
    }

    const next = !isSoundEnabled;
    setIsSoundEnabled(next);
    setToast(next ? `Ambient sound: ${SOUND_LABELS[soundPreset]}` : 'Ambient sound off');
  };

  const handleSelectSoundPreset = (preset: AmbientSoundPreset) => {
    setSoundPreset(preset);

    if (preset === 'off') {
      setIsSoundEnabled(false);
      setToast('Ambient sound off');
      return;
    }

    setIsSoundEnabled(true);
    setToast(`Ambient sound: ${SOUND_LABELS[preset]}`);
  };

  const handleAddTodo = (text: string) => {
    setTodos((current) => [createTodo(text), ...current]);
  };

  const handleToggleTodo = (todoId: string) => {
    setTodos((current) =>
      current.map((todo) => (todo.id === todoId ? { ...todo, completed: !todo.completed } : todo))
    );
  };

  const handleDeleteTodo = (todoId: string) => {
    setTodos((current) => current.filter((todo) => todo.id !== todoId));
  };

  const handleBoardPositionChange = (boardId: string, nextPosition: Position2D) => {
    setBoardPositions((current) => ({
      ...current,
      [boardId]: nextPosition,
    }));
  };

  const handleToggleBoardMinimize = (boardId: string) => {
    setMinimizedBoardIds((current) =>
      current.includes(boardId) ? current.filter((id) => id !== boardId) : [...current, boardId]
    );
  };

  const handleWallpaperUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setWallpaper(reader.result);
        setToast('Wallpaper updated');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleExportData = () => {
    const payload = {
      pages,
      activePageId,
      wallpaper,
      layoutMode,
      viewMode,
      filterMode,
      isIncognito,
      todos,
      boardPositions,
      minimizedBoardIds,
      todoPosition,
      clockPosition,
      isTodoMinimized,
      isClockMinimized,
      soundPreset,
      soundVolume,
      isSoundEnabled,
      exportedAt: nowIso(),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `easinav-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setToast('Export complete');
  };

  const handleImportData = async (file: File) => {
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as unknown;
      const restored = sanitizeAppData(parsed);
      if (!restored) {
        throw new Error('Invalid backup format');
      }

      setPages(restored.pages);
      setActivePageId(restored.activePageId);
      setWallpaper(restored.wallpaper);
      setLayoutMode(restored.layoutMode);
      setViewMode(restored.viewMode);
      setFilterMode(restored.filterMode);
      setIsIncognito(restored.isIncognito);
      setTodos(restored.todos);
      setBoardPositions(restored.boardPositions);
      setMinimizedBoardIds(restored.minimizedBoardIds);
      setTodoPosition(restored.todoPosition);
      setClockPosition(restored.clockPosition);
      setIsTodoMinimized(restored.isTodoMinimized);
      setIsClockMinimized(restored.isClockMinimized);
      setSoundPreset(restored.soundPreset);
      setSoundVolume(restored.soundVolume);
      setIsSoundEnabled(restored.isSoundEnabled && restored.soundPreset !== 'off');
      setIsSettingsOpen(false);
      setToast('Backup imported');
    } catch {
      setToast('Import failed: invalid file');
    }
  };

  const handleImportChromeBookmarks = async () => {
    const chromeBookmarks = (
      globalThis as {
        chrome?: {
          bookmarks?: {
            getTree?: (callback: (nodes: BookmarkApiNode[]) => void) => void;
          };
        };
      }
    ).chrome?.bookmarks;

    if (!chromeBookmarks?.getTree) {
      setToast('Chrome bookmarks API unavailable in this context');
      return;
    }

    const tree = await new Promise<BookmarkApiNode[]>((resolve) => chromeBookmarks.getTree?.(resolve));
    const importedBoards = convertChromeBookmarksToBoards(tree);
    if (!importedBoards.length) {
      setToast('No bookmarks found to import');
      return;
    }

    updateActivePage((page) => ({ ...page, boards: [...page.boards, ...importedBoards] }));
    setToast(
      `Imported ${importedBoards.reduce((sum, board) => sum + board.bookmarks.length, 0)} bookmarks`
    );
  };

  const handleResetAll = () => {
    const confirmed = window.confirm(
      'Reset all pages, boards, and links to defaults? Your current layout will be replaced.'
    );
    if (!confirmed) {
      return;
    }

    const defaults = createDefaultAppData();
    setPages(defaults.pages);
    setActivePageId(defaults.activePageId);
    setWallpaper(defaults.wallpaper);
    setLayoutMode(defaults.layoutMode);
    setViewMode(defaults.viewMode);
    setFilterMode(defaults.filterMode);
    setIsIncognito(defaults.isIncognito);
    setTodos(defaults.todos);
    setBoardPositions(defaults.boardPositions);
    setMinimizedBoardIds(defaults.minimizedBoardIds);
    setTodoPosition(defaults.todoPosition);
    setClockPosition(defaults.clockPosition);
    setIsTodoMinimized(defaults.isTodoMinimized);
    setIsClockMinimized(defaults.isClockMinimized);
    setSoundPreset(defaults.soundPreset);
    setSoundVolume(defaults.soundVolume);
    setIsSoundEnabled(defaults.isSoundEnabled);
    setSearchQuery('');
    setIsSearchOpen(false);
    setIsDeleteMode(false);
    setToast('App reset to defaults');
  };

  const handleEditorSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor) {
      return;
    }

    const title = formTitle.trim();
    if (!title) {
      setFormError('Title is required.');
      return;
    }

    try {
      switch (editor.type) {
        case 'create-page': {
          const newPage: PageType = { id: createId('page'), title, boards: [] };
          setPages((currentPages) => [...currentPages, newPage]);
          setActivePageId(newPage.id);
          setToast(`Created page "${title}"`);
          break;
        }

        case 'rename-page': {
          setPages((currentPages) =>
            currentPages.map((page) =>
              page.id === editor.pageId
                ? {
                    ...page,
                    title,
                  }
                : page
            )
          );
          setToast('Page renamed');
          break;
        }

        case 'create-board': {
          updateActivePage((page) => ({
            ...page,
            boards: [...page.boards, { id: createId('board'), title, bookmarks: [] }],
          }));
          setToast(`Created board "${title}"`);
          break;
        }

        case 'rename-board': {
          updateActivePage((page) => ({
            ...page,
            boards: page.boards.map((board) =>
              board.id === editor.boardId
                ? {
                    ...board,
                    title,
                  }
                : board
            ),
          }));
          setToast('Board renamed');
          break;
        }

        case 'create-bookmark': {
          const normalizedUrl = normalizeUrl(formUrl);
          updateActivePage((page) => ({
            ...page,
            boards: page.boards.map((board) =>
              board.id === editor.boardId
                ? {
                    ...board,
                    bookmarks: [createBookmark(title, normalizedUrl), ...board.bookmarks],
                  }
                : board
            ),
          }));
          setToast(`Added link "${title}"`);
          break;
        }

        case 'edit-bookmark': {
          const normalizedUrl = normalizeUrl(formUrl);
          updateActivePage((page) => ({
            ...page,
            boards: page.boards.map((board) =>
              board.id !== editor.boardId
                ? board
                : {
                    ...board,
                    bookmarks: board.bookmarks.map((bookmark) =>
                      bookmark.id !== editor.bookmarkId
                        ? bookmark
                        : {
                            ...bookmark,
                            title,
                            url: normalizedUrl,
                            icon: getFaviconForUrl(normalizedUrl),
                            updatedAt: nowIso(),
                          }
                    ),
                  }
            ),
          }));
          setToast('Link updated');
          break;
        }
      }

      closeEditor();
    } catch {
      setFormError('Please enter a valid URL.');
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    if (dragDisabled) {
      return;
    }

    const activeId = event.active.id;

    if (isBoardDndId(activeId)) {
      const boardId = extractBoardId(activeId);
      const board = activePage?.boards.find((item) => item.id === boardId);
      setActiveDragLabel(board ? `Board: ${board.title}` : null);
      return;
    }

    if (isBookmarkDndId(activeId)) {
      const bookmarkId = extractBookmarkId(activeId);
      const board = activePage?.boards.find((item) =>
        item.bookmarks.some((bookmark) => bookmark.id === bookmarkId)
      );
      const bookmark = board?.bookmarks.find((item) => item.id === bookmarkId);
      setActiveDragLabel(bookmark ? `Link: ${bookmark.title}` : null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragLabel(null);

    if (dragDisabled || !activePage) {
      return;
    }

    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    if (!isBookmarkDndId(active.id) || (!isBookmarkDndId(over.id) && !isBoardDndId(over.id))) {
      return;
    }

    const movingBookmarkId = extractBookmarkId(active.id);

    updateActivePage((page) => {
      const sourceBoardIndex = page.boards.findIndex((board) =>
        board.bookmarks.some((bookmark) => bookmark.id === movingBookmarkId)
      );
      if (sourceBoardIndex < 0) {
        return page;
      }

      const sourceBoard = page.boards[sourceBoardIndex];
      const sourceBookmarkIndex = sourceBoard.bookmarks.findIndex(
        (bookmark) => bookmark.id === movingBookmarkId
      );
      if (sourceBookmarkIndex < 0) {
        return page;
      }

      const destinationBoardId = isBoardDndId(over.id)
        ? extractBoardId(over.id)
        : page.boards.find((board) =>
            board.bookmarks.some((bookmark) => bookmark.id === extractBookmarkId(over.id))
          )?.id;

      if (!destinationBoardId) {
        return page;
      }

      const destinationBoardIndex = page.boards.findIndex((board) => board.id === destinationBoardId);
      if (destinationBoardIndex < 0) {
        return page;
      }

      const nextBoards = page.boards.map((board) => ({
        ...board,
        bookmarks: [...board.bookmarks],
      }));

      const [movingBookmark] = nextBoards[sourceBoardIndex].bookmarks.splice(sourceBookmarkIndex, 1);
      if (!movingBookmark) {
        return page;
      }

      let destinationIndex = nextBoards[destinationBoardIndex].bookmarks.length;
      if (isBookmarkDndId(over.id)) {
        const overBookmarkId = extractBookmarkId(over.id);
        const overIndex = nextBoards[destinationBoardIndex].bookmarks.findIndex(
          (bookmark) => bookmark.id === overBookmarkId
        );
        destinationIndex =
          overIndex >= 0 ? overIndex : nextBoards[destinationBoardIndex].bookmarks.length;
      }

      if (sourceBoardIndex === destinationBoardIndex && sourceBookmarkIndex < destinationIndex) {
        destinationIndex -= 1;
      }

      nextBoards[destinationBoardIndex].bookmarks.splice(destinationIndex, 0, movingBookmark);
      return { ...page, boards: nextBoards };
    });
  };

  if (!activePage) {
    return null;
  }

  const editorTitleMap: Record<EditorState['type'], string> = {
    'create-page': 'Create Page',
    'rename-page': 'Rename Page',
    'create-board': 'Create Board',
    'rename-board': 'Rename Board',
    'create-bookmark': 'Add Link',
    'edit-bookmark': 'Edit Link',
  };

  const editorSubmitLabelMap: Record<EditorState['type'], string> = {
    'create-page': 'Create page',
    'rename-page': 'Save changes',
    'create-board': 'Create board',
    'rename-board': 'Save changes',
    'create-bookmark': 'Add link',
    'edit-bookmark': 'Update link',
  };

  const isBookmarkEditor = editor?.type === 'create-bookmark' || editor?.type === 'edit-bookmark';

  return (
    <div className="relative min-h-screen overflow-hidden text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          key={wallpaper}
          initial={{ scale: 1.06, opacity: 0.7 }}
          animate={{ scale: 1, opacity: 0.9 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${wallpaper})` }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,rgba(255,106,0,0.18),transparent_40%),radial-gradient(circle_at_76%_78%,rgba(255,106,0,0.12),transparent_44%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-black/90" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-transparent to-black/70" />
        <div className="absolute inset-0 shadow-[inset_0_0_220px_rgba(0,0,0,0.88)]" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <TopNav
          pages={pages}
          activePageId={activePage.id}
          onPageSelect={setActivePageId}
          onAddPage={openCreatePageEditor}
          onRenameActivePage={openRenamePageEditor}
          onDeleteActivePage={handleDeleteActivePage}
          canDeleteActivePage={pages.length > 1}
        />

        <main className="futuristic-scrollbar flex-1 overflow-y-auto px-4 pb-28 pt-6 sm:px-8 lg:px-12 lg:pb-12 lg:pr-24">
          <div className="mx-auto w-full max-w-[1440px]">
            <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 backdrop-blur-2xl sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 text-sm text-slate-200">
                <Sparkles size={15} className="text-[#ff8f3f]" />
                <span className="font-medium">{activePage.title}</span>
                <span className="text-slate-400">| {totalBoards} boards</span>
                <span className="text-slate-400">| {totalLinks} links</span>
                {searchQuery.trim() ? <span className="text-slate-300">| {visibleLinks} matches</span> : null}
                {isIncognito ? <span className="text-[#ffb06b]">| Incognito ON</span> : null}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleQuickLink}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200 transition-all hover:border-[#ff6a00]/60 hover:text-[#ff9b58]"
                  title="Add link quickly"
                >
                  <Plus size={14} />
                  Quick Link
                </button>
              </div>
            </div>

            {isSearchOpen ? (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-5 flex items-center gap-2 rounded-2xl border border-white/15 bg-black/35 px-3 py-2.5 backdrop-blur-2xl"
              >
                <Search size={16} className="text-[#ff9b58]" />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search boards, titles, and URLs..."
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (searchQuery) {
                      setSearchQuery('');
                    } else {
                      setIsSearchOpen(false);
                    }
                  }}
                  className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-300 transition-colors hover:bg-white/10"
                  aria-label="Close search"
                >
                  <X size={14} />
                </button>
              </motion.div>
            ) : null}

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <motion.section
                className={cn(
                  'grid w-full gap-5',
                  layoutMode === 'grid'
                    ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
                    : 'grid-cols-1 xl:grid-cols-2'
                )}
              >
                {visibleBoards.map((board) => (
                  <Board
                    key={board.id}
                    board={board}
                    viewMode={viewMode}
                    position={getBoardPosition(board.id)}
                    isMinimized={isBoardMinimized(board.id)}
                    compactBlur={compactBlur}
                    deleteMode={isDeleteMode}
                    dragDisabled={dragDisabled}
                    onPositionChange={handleBoardPositionChange}
                    onToggleMinimize={handleToggleBoardMinimize}
                    onAddBookmark={openCreateBookmarkEditor}
                    onRenameBoard={openRenameBoardEditor}
                    onDeleteBoard={handleDeleteBoard}
                    onEditBookmark={openEditBookmarkEditor}
                    onDeleteBookmark={handleDeleteBookmark}
                    onToggleBookmarkFavorite={handleToggleBookmarkFavorite}
                  />
                ))}

                {!searchQuery.trim() && filterMode === 'all' ? (
                  <AddBoardCard onClick={openCreateBoardEditor} />
                ) : null}
              </motion.section>

              <DragOverlay>
                {activeDragLabel ? (
                  <div className="rounded-xl border border-[#ff6a00]/60 bg-black/80 px-3 py-2 text-sm text-white shadow-[0_0_30px_rgba(255,106,0,0.45)]">
                    {activeDragLabel}
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>

            {visibleBoards.length === 0 ? (
              <div className="mt-8 rounded-2xl border border-dashed border-white/20 bg-black/30 p-8 text-center text-sm text-slate-300">
                No results for your current filters. Try adjusting search/filter or add a new board.
              </div>
            ) : null}
          </div>
        </main>
      </div>

      <FloatingActions
        onSearch={() => setIsSearchOpen((value) => !value)}
        onDownload={handleExportData}
        onFilter={() => setFilterMode((mode) => (mode === 'all' ? 'favorites' : 'all'))}
        onIncognitoToggle={handleToggleIncognito}
        onLayoutToggle={() => setLayoutMode((mode) => (mode === 'grid' ? 'list' : 'grid'))}
        onDeleteModeToggle={() => setIsDeleteMode((value) => !value)}
        onViewModeToggle={() => setViewMode((mode) => (mode === 'comfortable' ? 'compact' : 'comfortable'))}
        onSettings={() => setIsSettingsOpen((value) => !value)}
        isSearchActive={isSearchOpen}
        isFavoritesFilterActive={filterMode === 'favorites'}
        isIncognito={isIncognito}
        isListLayout={layoutMode === 'list'}
        isDeleteMode={isDeleteMode}
        isCompactView={viewMode === 'compact'}
        isSettingsOpen={isSettingsOpen}
      />
      <WallpaperButton onWallpaperSelected={handleWallpaperUpload} />
      <TodoPanel
        todos={todos}
        position={todoPosition}
        isMinimized={isTodoMinimized}
        onPositionChange={setTodoPosition}
        onToggleMinimize={() => setIsTodoMinimized((value) => !value)}
        onAddTodo={handleAddTodo}
        onToggleTodo={handleToggleTodo}
        onDeleteTodo={handleDeleteTodo}
      />
      <TimeDateCard
        position={clockPosition}
        isMinimized={isClockMinimized}
        onPositionChange={setClockPosition}
        onToggleMinimize={() => setIsClockMinimized((value) => !value)}
      />

      <Modal
        isOpen={Boolean(editor)}
        title={editor ? editorTitleMap[editor.type] : ''}
        description={
          isBookmarkEditor ? 'Give your link a clear title and valid URL.' : 'Use concise names for quick scanning.'
        }
        onClose={closeEditor}
      >
        <form className="space-y-4" onSubmit={handleEditorSubmit}>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-200">Title</label>
            <input
              value={formTitle}
              onChange={(event) => setFormTitle(event.target.value)}
              className="w-full rounded-xl border border-white/15 bg-black/35 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-[#ff6a00]/70"
              placeholder={
                editor?.type === 'create-page'
                  ? 'Ex. Personal'
                  : editor?.type === 'create-board'
                    ? 'Ex. AI Tools'
                    : 'Ex. ChatGPT'
              }
            />
          </div>

          {isBookmarkEditor ? (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-200">URL</label>
              <input
                value={formUrl}
                onChange={(event) => setFormUrl(event.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/35 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-[#ff6a00]/70"
                placeholder="https://example.com"
              />
            </div>
          ) : null}

          {formError ? <p className="text-sm text-red-300">{formError}</p> : null}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeEditor}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl border border-[#ff6a00]/70 bg-[#ff6a00] px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[#ff7b1f]"
            >
              {editor ? editorSubmitLabelMap[editor.type] : 'Save'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isSettingsOpen}
        title="Settings"
        description="Import/export your data, sync with Chrome bookmarks, and tune the dashboard."
        onClose={() => setIsSettingsOpen(false)}
      >
        <input
          ref={importInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void handleImportData(file);
            }
            event.target.value = '';
          }}
        />

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleExportData}
            className="flex w-full items-center gap-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-left text-sm text-slate-200 transition-colors hover:bg-white/10"
          >
            <Download size={16} className="text-[#ff9b58]" />
            Export backup
          </button>

          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="flex w-full items-center gap-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-left text-sm text-slate-200 transition-colors hover:bg-white/10"
          >
            <Upload size={16} className="text-[#ff9b58]" />
            Import backup
          </button>

          <button
            type="button"
            onClick={handleImportChromeBookmarks}
            className="flex w-full items-center gap-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-left text-sm text-slate-200 transition-colors hover:bg-white/10"
          >
            <FileUp size={16} className="text-[#ff9b58]" />
            Import from Chrome bookmarks
          </button>

          <button
            type="button"
            onClick={() => {
              setWallpaper(DEFAULT_WALLPAPER);
              setToast('Wallpaper reset');
            }}
            className="flex w-full items-center gap-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-left text-sm text-slate-200 transition-colors hover:bg-white/10"
          >
            <RotateCcw size={16} className="text-[#ff9b58]" />
            Reset wallpaper
          </button>

          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
              Wallpaper Library
            </p>
            <div className="grid grid-cols-2 gap-2">
              {WALLPAPER_LIBRARY.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setWallpaper(item.url);
                    setToast(`Wallpaper: ${item.name}`);
                  }}
                  className={cn(
                    'group overflow-hidden rounded-lg border text-left transition-all',
                    wallpaper === item.url
                      ? 'border-[#ff6a00]/70 shadow-[0_0_18px_rgba(255,106,0,0.35)]'
                      : 'border-white/15 hover:border-white/35'
                  )}
                >
                  <div
                    className="h-16 w-full bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
                    style={{ backgroundImage: `url(${item.url})` }}
                  />
                  <p className="truncate px-2 py-1.5 text-[11px] text-slate-200">{item.name}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Ambient Sounds</p>
              <button
                type="button"
                onClick={handleToggleAmbientSound}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition-all',
                  isSoundEnabled && soundPreset !== 'off'
                    ? 'border-[#ff6a00]/70 bg-[#ff6a00]/20 text-[#ffb06b]'
                    : 'border-white/20 bg-white/5 text-slate-200 hover:border-white/35'
                )}
              >
                {isSoundEnabled && soundPreset !== 'off' ? <Pause size={12} /> : <Play size={12} />}
                {isSoundEnabled && soundPreset !== 'off' ? 'Pause' : 'Play'}
              </button>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-2">
              {AMBIENT_SOUND_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleSelectSoundPreset(preset)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-left text-xs font-medium transition-all',
                    preset === soundPreset
                      ? 'border-[#ff6a00]/70 bg-[#ff6a00]/20 text-[#ffb06b]'
                      : 'border-white/15 bg-white/5 text-slate-200 hover:border-white/30'
                  )}
                >
                  {SOUND_LABELS[preset]}
                </button>
              ))}
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs text-slate-300">
                <span className="inline-flex items-center gap-1.5">
                  <Volume2 size={12} className="text-[#ff9b58]" />
                  Volume
                </span>
                <span>{Math.round(soundVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={soundVolume}
                onChange={(event) => setSoundVolume(Number(event.target.value))}
                className="w-full accent-[#ff6a00]"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetAll}
            className="flex w-full items-center gap-3 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-left text-sm text-red-100 transition-colors hover:bg-red-500/20"
          >
            <RotateCcw size={16} />
            Reset full app
          </button>
        </div>
      </Modal>

      {toast ? (
        <div className="fixed bottom-5 left-1/2 z-[80] -translate-x-1/2 rounded-full border border-white/20 bg-black/70 px-4 py-2 text-sm text-slate-100 backdrop-blur-xl">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

export default App;
