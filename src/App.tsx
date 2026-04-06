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
  Command,
  Download,
  FileUp,
  History,
  Pin,
  Pause,
  Play,
  RotateCcw,
  Search,
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
import { VaultPanel } from './components/VaultPanel';
import type {
  AppData,
  AmbientSoundPreset,
  BoardSizePreset,
  BoardType,
  Bookmark,
  FilterMode,
  LinkUsageEntry,
  PageType,
  Position2D,
  QuickSavedLink,
  TodoItem,
  VaultEntry,
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

interface CommandPaletteItem {
  id: string;
  label: string;
  description: string;
  keywords: string;
  run: () => void;
}

interface VaultPrefillDraft {
  title: string;
  website: string;
  linkedBookmarkUrl?: string;
  token: string;
}

const createId = (prefix: string) => {
  const fallback = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const uuid = globalThis.crypto?.randomUUID?.() ?? fallback;
  return `${prefix}-${uuid}`;
};

const nowIso = () => new Date().toISOString();
const DEFAULT_TODO_POSITION: Position2D = { x: 0, y: 0 };
const DEFAULT_VAULT_POSITION: Position2D = { x: 0, y: 0 };
const DEFAULT_CLOCK_POSITION: Position2D = { x: 0, y: 0 };
const DEFAULT_SOUND_PRESET: AmbientSoundPreset = 'off';
const DEFAULT_SOUND_VOLUME = 0.35;
const DEFAULT_BOARD_SIZE: BoardSizePreset = 'normal';

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

const normalizeOptionalUrl = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return normalizeUrl(trimmed);
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

interface CreateVaultEntryInput {
  id?: string;
  title: string;
  username?: string;
  password?: string;
  website?: string;
  linkedBookmarkUrl?: string;
  notes?: string;
}

const createVaultEntry = ({
  id,
  title,
  username,
  password,
  website,
  linkedBookmarkUrl,
  notes,
}: CreateVaultEntryInput): VaultEntry => ({
  id: id ?? createId('vault'),
  title: title.trim(),
  username: username?.trim() ?? '',
  password: password?.trim() ?? '',
  website,
  linkedBookmarkUrl,
  notes: notes?.trim() || undefined,
  createdAt: nowIso(),
  updatedAt: nowIso(),
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
    vaultEntries: [],
    vaultPasscode: '',
    isVaultVisible: false,
    boardPositions: {},
    boardSizes: {},
    linkUsage: {},
    minimizedBoardIds: [],
    todoPosition: DEFAULT_TODO_POSITION,
    vaultPosition: DEFAULT_VAULT_POSITION,
    clockPosition: DEFAULT_CLOCK_POSITION,
    isTodoMinimized: false,
    isVaultMinimized: false,
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
    pinned: Boolean(candidate.pinned),
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
    pinned: Boolean(candidate.pinned),
    bookmarks,
  };
};

const sanitizeLinkUsage = (raw: unknown): Record<string, LinkUsageEntry> => {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const next: Record<string, LinkUsageEntry> = {};
  Object.entries(raw as Record<string, unknown>).forEach(([, value]) => {
    if (!value || typeof value !== 'object') {
      return;
    }

    const candidate = value as Partial<LinkUsageEntry>;
    if (typeof candidate.url !== 'string' || !candidate.url.trim()) {
      return;
    }

    try {
      const normalizedUrl = normalizeUrl(candidate.url);
      next[normalizedUrl] = {
        url: normalizedUrl,
        title:
          typeof candidate.title === 'string' && candidate.title.trim()
            ? candidate.title.trim()
            : new URL(normalizedUrl).hostname,
        openCount:
          typeof candidate.openCount === 'number' && Number.isFinite(candidate.openCount)
            ? Math.max(0, Math.floor(candidate.openCount))
            : 0,
        lastOpenedAt:
          typeof candidate.lastOpenedAt === 'string' && candidate.lastOpenedAt
            ? candidate.lastOpenedAt
            : nowIso(),
      };
    } catch {
      return;
    }
  });

  return next;
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

const sanitizeVaultEntries = (raw: unknown): VaultEntry[] => {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item): VaultEntry | null => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const candidate = item as Partial<VaultEntry>;
      if (typeof candidate.title !== 'string' || !candidate.title.trim()) {
        return null;
      }

      let website: string | undefined;
      if (typeof candidate.website === 'string') {
        try {
          website = normalizeOptionalUrl(candidate.website);
        } catch {
          website = undefined;
        }
      }

      let linkedBookmarkUrl: string | undefined;
      if (typeof candidate.linkedBookmarkUrl === 'string') {
        try {
          linkedBookmarkUrl = normalizeOptionalUrl(candidate.linkedBookmarkUrl);
        } catch {
          linkedBookmarkUrl = undefined;
        }
      }

      return {
        id: typeof candidate.id === 'string' && candidate.id ? candidate.id : createId('vault'),
        title: candidate.title.trim(),
        username:
          typeof candidate.username === 'string' && candidate.username.trim()
            ? candidate.username.trim()
            : '',
        password:
          typeof candidate.password === 'string' && candidate.password.trim()
            ? candidate.password.trim()
            : '',
        website,
        linkedBookmarkUrl,
        notes: typeof candidate.notes === 'string' && candidate.notes.trim() ? candidate.notes.trim() : undefined,
        createdAt:
          typeof candidate.createdAt === 'string' && candidate.createdAt
            ? candidate.createdAt
            : nowIso(),
        updatedAt:
          typeof candidate.updatedAt === 'string' && candidate.updatedAt
            ? candidate.updatedAt
            : nowIso(),
      };
    })
    .filter((entry): entry is VaultEntry => entry !== null);
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

const sanitizeBoardSizes = (raw: unknown): Record<string, BoardSizePreset> => {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const next: Record<string, BoardSizePreset> = {};
  Object.entries(raw as Record<string, unknown>).forEach(([boardId, value]) => {
    if (value === 'compact' || value === 'normal' || value === 'expanded') {
      next[boardId] = value;
    }
  });

  return next;
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
  const vaultEntries = sanitizeVaultEntries(candidate.vaultEntries);
  const vaultPasscode =
    typeof candidate.vaultPasscode === 'string' ? candidate.vaultPasscode : '';
  const boardPositions = sanitizeBoardPositions(candidate.boardPositions);
  const boardSizes = sanitizeBoardSizes(candidate.boardSizes);
  const soundPreset = sanitizeSoundPreset(candidate.soundPreset);
  const soundVolume = sanitizeSoundVolume(candidate.soundVolume);
  const linkUsage = sanitizeLinkUsage(candidate.linkUsage);
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
    vaultEntries,
    vaultPasscode,
    isVaultVisible: Boolean(candidate.isVaultVisible),
    boardPositions,
    boardSizes,
    linkUsage,
    minimizedBoardIds,
    todoPosition: sanitizePosition(candidate.todoPosition, DEFAULT_TODO_POSITION),
    vaultPosition: sanitizePosition(candidate.vaultPosition, DEFAULT_VAULT_POSITION),
    clockPosition: sanitizePosition(candidate.clockPosition, DEFAULT_CLOCK_POSITION),
    isTodoMinimized: Boolean(candidate.isTodoMinimized),
    isVaultMinimized: Boolean(candidate.isVaultMinimized),
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
  const [vaultEntries, setVaultEntries] = useState<VaultEntry[]>(defaultData.vaultEntries);
  const [vaultPasscode, setVaultPasscode] = useState(defaultData.vaultPasscode);
  const [isVaultVisible, setIsVaultVisible] = useState(defaultData.isVaultVisible);
  const [boardPositions, setBoardPositions] = useState<Record<string, Position2D>>(
    defaultData.boardPositions
  );
  const [boardSizes, setBoardSizes] = useState<Record<string, BoardSizePreset>>(defaultData.boardSizes);
  const [linkUsage, setLinkUsage] = useState<Record<string, LinkUsageEntry>>(defaultData.linkUsage);
  const [minimizedBoardIds, setMinimizedBoardIds] = useState<string[]>(defaultData.minimizedBoardIds);
  const [todoPosition, setTodoPosition] = useState<Position2D>(defaultData.todoPosition);
  const [vaultPosition, setVaultPosition] = useState<Position2D>(defaultData.vaultPosition);
  const [clockPosition, setClockPosition] = useState<Position2D>(defaultData.clockPosition);
  const [isTodoMinimized, setIsTodoMinimized] = useState(defaultData.isTodoMinimized);
  const [isVaultMinimized, setIsVaultMinimized] = useState(defaultData.isVaultMinimized);
  const [isClockMinimized, setIsClockMinimized] = useState(defaultData.isClockMinimized);
  const [soundPreset, setSoundPreset] = useState<AmbientSoundPreset>(defaultData.soundPreset);
  const [soundVolume, setSoundVolume] = useState(defaultData.soundVolume);
  const [isSoundEnabled, setIsSoundEnabled] = useState(defaultData.isSoundEnabled);

  const [isHydrated, setIsHydrated] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [activeDragLabel, setActiveDragLabel] = useState<string | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [commandPaletteQuery, setCommandPaletteQuery] = useState('');
  const [commandPaletteIndex, setCommandPaletteIndex] = useState(0);
  const [vaultPrefillDraft, setVaultPrefillDraft] = useState<VaultPrefillDraft | null>(null);
  const [isVaultUnlocked, setIsVaultUnlocked] = useState(!defaultData.vaultPasscode);
  const [vaultPasscodeDraft, setVaultPasscodeDraft] = useState('');
  const [vaultUnlockDraft, setVaultUnlockDraft] = useState('');
  const [isVaultUnlockModalOpen, setIsVaultUnlockModalOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const linkSearchInputRef = useRef<HTMLInputElement>(null);
  const commandPaletteInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const wallpaperInputRef = useRef<HTMLInputElement>(null);
  const isApplyingExternalStorageRef = useRef(false);
  const lastPersistedSnapshotRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const stopAmbientSoundRef = useRef<(() => void) | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
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
      setVaultEntries(restored.vaultEntries);
      setVaultPasscode(restored.vaultPasscode);
      setIsVaultVisible(restored.isVaultVisible);
      setIsVaultUnlocked(!restored.vaultPasscode);
      setBoardPositions(restored.boardPositions);
      setBoardSizes(restored.boardSizes);
      setLinkUsage(restored.linkUsage);
      setMinimizedBoardIds(restored.minimizedBoardIds);
      setTodoPosition(restored.todoPosition);
      setVaultPosition(restored.vaultPosition);
      setClockPosition(restored.clockPosition);
      setIsTodoMinimized(restored.isTodoMinimized);
      setIsVaultMinimized(restored.isVaultMinimized);
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
      setVaultEntries(restored.vaultEntries);
      setVaultPasscode(restored.vaultPasscode);
      setIsVaultVisible(restored.isVaultVisible);
      setIsVaultUnlocked(!restored.vaultPasscode);
      setBoardPositions(restored.boardPositions);
      setBoardSizes(restored.boardSizes);
      setLinkUsage(restored.linkUsage);
      setMinimizedBoardIds(restored.minimizedBoardIds);
      setTodoPosition(restored.todoPosition);
      setVaultPosition(restored.vaultPosition);
      setClockPosition(restored.clockPosition);
      setIsTodoMinimized(restored.isTodoMinimized);
      setIsVaultMinimized(restored.isVaultMinimized);
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
      vaultEntries,
      vaultPasscode,
      isVaultVisible,
      boardPositions,
      boardSizes,
      linkUsage,
      minimizedBoardIds,
      todoPosition,
      vaultPosition,
      clockPosition,
      isTodoMinimized,
      isVaultMinimized,
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
    boardSizes,
    clockPosition,
    filterMode,
    isClockMinimized,
    isHydrated,
    isIncognito,
    isSoundEnabled,
    isTodoMinimized,
    isVaultMinimized,
    isVaultVisible,
    layoutMode,
    linkUsage,
    minimizedBoardIds,
    pages,
    soundPreset,
    soundVolume,
    todoPosition,
    todos,
    vaultPasscode,
    vaultEntries,
    vaultPosition,
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
    if (!isHydrated) {
      return;
    }

    const focusLinkSearch = () => {
      if (editor || isSettingsOpen || isCommandPaletteOpen) {
        return;
      }

      linkSearchInputRef.current?.focus();
    };

    const timeout = window.setTimeout(focusLinkSearch, 70);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        focusLinkSearch();
      }
    };

    window.addEventListener('focus', focusLinkSearch);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('focus', focusLinkSearch);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [editor, isCommandPaletteOpen, isHydrated, isSettingsOpen]);

  useEffect(() => {
    if (!isCommandPaletteOpen) {
      return;
    }

    commandPaletteInputRef.current?.focus();
  }, [isCommandPaletteOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsCommandPaletteOpen((value) => !value);
        setCommandPaletteQuery('');
        setCommandPaletteIndex(0);
        return;
      }

      if (event.key === 'Escape') {
        setIsCommandPaletteOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

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

        const sortPinnedBookmarks = (bookmarks: Bookmark[]) =>
          [...bookmarks].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));

        if (!query) {
          return { ...board, bookmarks: sortPinnedBookmarks(boardBookmarks) };
        }

        const boardTitleMatch = board.title.toLowerCase().includes(query);
        const matchingBookmarks = boardTitleMatch
          ? boardBookmarks
          : boardBookmarks.filter((bookmark) =>
              `${bookmark.title} ${bookmark.url}`.toLowerCase().includes(query)
            );

        return { ...board, bookmarks: sortPinnedBookmarks(matchingBookmarks) };
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
      })
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
  }, [activePage, filterMode, searchQuery]);

  const bookmarkByUrl = useMemo(() => {
    const map = new Map<string, Bookmark>();
    if (!activePage) {
      return map;
    }

    activePage.boards.forEach((board) => {
      board.bookmarks.forEach((bookmark) => {
        if (!map.has(bookmark.url)) {
          map.set(bookmark.url, bookmark);
        }
      });
    });

    return map;
  }, [activePage]);

  const vaultAttachmentCountByUrl = useMemo(() => {
    const next: Record<string, number> = {};
    vaultEntries.forEach((entry) => {
      if (!entry.linkedBookmarkUrl) {
        return;
      }

      next[entry.linkedBookmarkUrl] = (next[entry.linkedBookmarkUrl] ?? 0) + 1;
    });
    return next;
  }, [vaultEntries]);

  const recentLinks = useMemo(() => {
    return Object.values(linkUsage)
      .filter((entry) => bookmarkByUrl.has(entry.url))
      .sort(
        (a, b) =>
          new Date(b.lastOpenedAt).getTime() - new Date(a.lastOpenedAt).getTime()
      )
      .slice(0, 6)
      .map((entry) => ({
        usage: entry,
        bookmark: bookmarkByUrl.get(entry.url)!,
      }));
  }, [bookmarkByUrl, linkUsage]);

  const linkSearchResults = useMemo(() => {
    const query = linkSearchQuery.trim().toLowerCase();
    if (!query || !activePage) {
      return [] as Array<{ boardTitle: string; bookmark: Bookmark }>;
    }

    const matches: Array<{ boardTitle: string; bookmark: Bookmark }> = [];

    activePage.boards.forEach((board) => {
      board.bookmarks.forEach((bookmark) => {
        const haystack = `${bookmark.title} ${bookmark.url}`.toLowerCase();
        if (haystack.includes(query)) {
          matches.push({
            boardTitle: board.title,
            bookmark,
          });
        }
      });
    });

    return matches
      .sort((a, b) => {
        const pinDiff = Number(Boolean(b.bookmark.pinned)) - Number(Boolean(a.bookmark.pinned));
        if (pinDiff !== 0) {
          return pinDiff;
        }

        return a.bookmark.title.localeCompare(b.bookmark.title);
      })
      .slice(0, 12);
  }, [activePage, linkSearchQuery]);

  const totalBoards = activePage?.boards.length ?? 0;

  const handleSelectBoardForNewLink = (boardId: string) => {
    openCreateBookmarkEditor(boardId);
  };

  const handleOpenBookmark = (boardId: string, bookmarkId: string) => {
    const board = activePage?.boards.find((item) => item.id === boardId);
    const bookmark = board?.bookmarks.find((item) => item.id === bookmarkId);
    if (!bookmark) {
      return;
    }

    openBookmarkUrl(bookmark);
  };

  const handleAttachBookmarkToVault = (boardId: string, bookmarkId: string) => {
    const board = activePage?.boards.find((item) => item.id === boardId);
    const bookmark = board?.bookmarks.find((item) => item.id === bookmarkId);
    if (!bookmark) {
      return;
    }

    if (vaultPasscode && !isVaultUnlocked) {
      setIsVaultUnlockModalOpen(true);
      setToast('Unlock vault to attach credentials');
      return;
    }

    setVaultPrefillDraft({
      title: bookmark.title,
      website: bookmark.url,
      linkedBookmarkUrl: bookmark.url,
      token: `${bookmark.id}-${Date.now()}`,
    });
    setIsVaultVisible(true);
    setIsVaultMinimized(false);
    setToast(`Vault linked to "${bookmark.title}"`);
  };

  const getBookmarkAttachmentCount = (bookmarkUrl: string): number =>
    vaultAttachmentCountByUrl[bookmarkUrl] ?? 0;

  const dragDisabled = Boolean(searchQuery.trim()) || filterMode === 'favorites';
  const compactBlur = viewMode === 'compact';

  const getBoardPosition = (boardId: string): Position2D => boardPositions[boardId] ?? { x: 0, y: 0 };
  const getBoardSizePreset = (boardId: string): BoardSizePreset =>
    boardSizes[boardId] ?? DEFAULT_BOARD_SIZE;
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
    setBoardSizes((current) => {
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

  const recordLinkOpen = (bookmark: Bookmark) => {
    setLinkUsage((current) => {
      const currentEntry = current[bookmark.url];
      return {
        ...current,
        [bookmark.url]: {
          url: bookmark.url,
          title: bookmark.title,
          openCount: (currentEntry?.openCount ?? 0) + 1,
          lastOpenedAt: nowIso(),
        },
      };
    });
  };

  const openBookmarkUrl = (bookmark: Bookmark) => {
    recordLinkOpen(bookmark);
    openUrlInNewTab(bookmark.url);
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

  const handleToggleBookmarkPinned = (boardId: string, bookmarkId: string) => {
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
                      pinned: !bookmark.pinned,
                      updatedAt: nowIso(),
                    }
              ),
            }
      ),
    }));
  };

  const handleToggleBoardPinned = (boardId: string) => {
    updateActivePage((page) => ({
      ...page,
      boards: page.boards.map((board) =>
        board.id !== boardId
          ? board
          : {
              ...board,
              pinned: !board.pinned,
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

  const handleAddVaultEntry = ({
    title,
    username,
    password,
    website,
    linkedBookmarkUrl,
    notes,
  }: {
    title: string;
    username: string;
    password: string;
    website: string;
    linkedBookmarkUrl?: string;
    notes: string;
  }): boolean => {
    if (vaultPasscode && !isVaultUnlocked) {
      setToast('Vault is locked. Unlock it from Settings first.');
      return false;
    }

    const normalizedTitle = title.trim();
    const normalizedUsername = username.trim();
    const normalizedPassword = password.trim();
    const normalizedNotes = notes.trim();

    if (!normalizedTitle) {
      setToast('Service title is required');
      return false;
    }

    if (!normalizedUsername && !normalizedPassword && !normalizedNotes && !website.trim()) {
      setToast('Add at least one detail (user, password, note, or website)');
      return false;
    }

    let normalizedWebsite: string | undefined;
    try {
      normalizedWebsite = normalizeOptionalUrl(website);
    } catch {
      setToast('Please enter a valid website URL');
      return false;
    }

    let normalizedLinkedBookmarkUrl: string | undefined;
    try {
      normalizedLinkedBookmarkUrl = normalizeOptionalUrl(linkedBookmarkUrl ?? '');
    } catch {
      normalizedLinkedBookmarkUrl = undefined;
    }

    setVaultEntries((current) => [
      createVaultEntry({
        title: normalizedTitle,
        username: normalizedUsername,
        password: normalizedPassword,
        website: normalizedWebsite,
        linkedBookmarkUrl: normalizedLinkedBookmarkUrl,
        notes: normalizedNotes,
      }),
      ...current,
    ]);
    setIsVaultVisible(true);
    setToast(`Saved "${normalizedTitle}"`);
    return true;
  };

  const handleDeleteVaultEntry = (entryId: string) => {
    const entry = vaultEntries.find((item) => item.id === entryId);
    setVaultEntries((current) => current.filter((item) => item.id !== entryId));
    setToast(entry ? `Removed "${entry.title}"` : 'Entry removed');
  };

  const handleOpenVaultWebsite = (entryId: string) => {
    const entry = vaultEntries.find((item) => item.id === entryId);
    if (!entry?.website) {
      return;
    }

    const chromeTabs = (
      globalThis as {
        chrome?: {
          tabs?: {
            create?: (createProperties: { url?: string; active?: boolean }, callback?: () => void) => void;
          };
        };
      }
    ).chrome?.tabs;

    if (chromeTabs?.create) {
      chromeTabs.create({ url: entry.website, active: true });
      return;
    }

    globalThis.open?.(entry.website, '_blank', 'noopener,noreferrer');
  };

  const handleCopyVaultValue = (value: string, label: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setToast(`${label} is empty`);
      return;
    }

    const fallbackCopy = () => {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = trimmed;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setToast(`${label} copied`);
      } catch {
        setToast(`Unable to copy ${label.toLowerCase()}`);
      }
    };

    if (navigator.clipboard?.writeText) {
      void navigator.clipboard
        .writeText(trimmed)
        .then(() => {
          setToast(`${label} copied`);
        })
        .catch(() => {
          fallbackCopy();
        });
      return;
    }

    fallbackCopy();
  };

  const handleSaveVaultPasscode = () => {
    const nextPasscode = vaultPasscodeDraft.trim();
    if (nextPasscode.length < 4) {
      setToast('Vault password must be at least 4 characters');
      return;
    }

    const isUpdating = Boolean(vaultPasscode);
    setVaultPasscode(nextPasscode);
    setVaultPasscodeDraft('');
    setVaultUnlockDraft('');
    setIsVaultUnlocked(false);
    setIsVaultVisible(false);
    setIsVaultUnlockModalOpen(false);
    setToast(isUpdating ? 'Vault password updated' : 'Vault password set');
  };

  const handleUnlockVault = (): boolean => {
    if (!vaultPasscode) {
      setIsVaultUnlocked(true);
      setIsVaultVisible(true);
      setIsVaultUnlockModalOpen(false);
      return true;
    }

    if (vaultUnlockDraft !== vaultPasscode) {
      setToast('Incorrect vault password');
      return false;
    }

    setVaultUnlockDraft('');
    setIsVaultUnlocked(true);
    setIsVaultVisible(true);
    setIsVaultUnlockModalOpen(false);
    setToast('Vault unlocked');
    return true;
  };

  const handleLockVault = () => {
    if (!vaultPasscode) {
      return;
    }

    setIsVaultUnlocked(false);
    setIsVaultVisible(false);
    setVaultUnlockDraft('');
    setIsVaultUnlockModalOpen(false);
    setToast('Vault locked');
  };

  const handleVaultHeaderLock = () => {
    if (!vaultPasscode) {
      setToast('Set a vault password in Settings to enable locking');
      return;
    }

    handleLockVault();
  };

  const handleRemoveVaultPasscode = () => {
    setVaultPasscode('');
    setVaultPasscodeDraft('');
    setVaultUnlockDraft('');
    setIsVaultUnlockModalOpen(false);
    setIsVaultUnlocked(true);
    setToast('Vault password removed');
  };

  const handleToggleVaultVisibility = () => {
    if (vaultPasscode && !isVaultUnlocked) {
      setIsVaultUnlockModalOpen(true);
      setToast('Enter vault password to open');
      return;
    }

    setIsVaultVisible((current) => !current);
  };

  const handleBoardPositionChange = (boardId: string, nextPosition: Position2D) => {
    setBoardPositions((current) => ({
      ...current,
      [boardId]: nextPosition,
    }));
  };

  const handleBoardSizeChange = (boardId: string, preset: BoardSizePreset) => {
    if (preset === 'normal') {
      setBoardSizes((current) => {
        const next = { ...current };
        delete next[boardId];
        return next;
      });
      return;
    }

    setBoardSizes((current) => ({
      ...current,
      [boardId]: preset,
    }));
  };

  const handleResetBoardSize = (boardId: string) => {
    setBoardSizes((current) => {
      if (!(boardId in current)) {
        return current;
      }

      const next = { ...current };
      delete next[boardId];
      return next;
    });
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
      vaultEntries,
      vaultPasscode,
      isVaultVisible,
      boardPositions,
      boardSizes,
      linkUsage,
      minimizedBoardIds,
      todoPosition,
      vaultPosition,
      clockPosition,
      isTodoMinimized,
      isVaultMinimized,
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
      setVaultEntries(restored.vaultEntries);
      setVaultPasscode(restored.vaultPasscode);
      setIsVaultVisible(restored.isVaultVisible);
      setIsVaultUnlocked(!restored.vaultPasscode);
      setBoardPositions(restored.boardPositions);
      setBoardSizes(restored.boardSizes);
      setLinkUsage(restored.linkUsage);
      setMinimizedBoardIds(restored.minimizedBoardIds);
      setTodoPosition(restored.todoPosition);
      setVaultPosition(restored.vaultPosition);
      setClockPosition(restored.clockPosition);
      setIsTodoMinimized(restored.isTodoMinimized);
      setIsVaultMinimized(restored.isVaultMinimized);
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
    setVaultEntries(defaults.vaultEntries);
    setVaultPasscode(defaults.vaultPasscode);
    setIsVaultVisible(defaults.isVaultVisible);
    setIsVaultUnlocked(!defaults.vaultPasscode);
    setVaultPasscodeDraft('');
    setVaultUnlockDraft('');
    setIsVaultUnlockModalOpen(false);
    setBoardPositions(defaults.boardPositions);
    setBoardSizes(defaults.boardSizes);
    setLinkUsage(defaults.linkUsage);
    setMinimizedBoardIds(defaults.minimizedBoardIds);
    setTodoPosition(defaults.todoPosition);
    setVaultPosition(defaults.vaultPosition);
    setClockPosition(defaults.clockPosition);
    setIsTodoMinimized(defaults.isTodoMinimized);
    setIsVaultMinimized(defaults.isVaultMinimized);
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

  const commandPaletteItems: CommandPaletteItem[] = [];

  commandPaletteItems.push(
    {
      id: 'create-page',
      label: 'Create page',
      description: 'Add a new workspace page',
      keywords: 'create page add workspace',
      run: openCreatePageEditor,
    },
    {
      id: 'create-board',
      label: 'Create board',
      description: 'Add a new board to current page',
      keywords: 'create board add section',
      run: openCreateBoardEditor,
    },
    {
      id: 'toggle-favorites',
      label: filterMode === 'favorites' ? 'Show all links' : 'Show favorites only',
      description: 'Toggle favorites filter',
      keywords: 'favorites filter toggle',
      run: () => setFilterMode((mode) => (mode === 'all' ? 'favorites' : 'all')),
    },
    {
      id: 'toggle-search',
      label: isSearchOpen ? 'Close search' : 'Open search',
      description: 'Toggle search bar',
      keywords: 'search find query',
      run: () => setIsSearchOpen((value) => !value),
    }
  );

  pages.forEach((page) => {
    commandPaletteItems.push({
      id: `switch-page-${page.id}`,
      label: `Go to page: ${page.title}`,
      description: 'Switch active page',
      keywords: `page switch ${page.title}`,
      run: () => setActivePageId(page.id),
    });
  });

  if (activePage) {
    activePage.boards.forEach((board) => {
      commandPaletteItems.push({
        id: `new-link-${board.id}`,
        label: `Add link to ${board.title}`,
        description: 'Create bookmark in selected board',
        keywords: `link bookmark add ${board.title}`,
        run: () => handleSelectBoardForNewLink(board.id),
      });

      board.bookmarks.forEach((bookmark) => {
        commandPaletteItems.push({
          id: `open-link-${bookmark.id}`,
          label: `Open: ${bookmark.title}`,
          description: bookmark.url,
          keywords: `open link ${bookmark.title} ${bookmark.url} ${board.title}`,
          run: () => openBookmarkUrl(bookmark),
        });
      });
    });
  }

  const filteredCommandPaletteItems = (() => {
    const query = commandPaletteQuery.trim().toLowerCase();
    if (!query) {
      return commandPaletteItems;
    }

    return commandPaletteItems.filter((item) =>
      `${item.label} ${item.description} ${item.keywords}`.toLowerCase().includes(query)
    );
  })();

  useEffect(() => {
    if (commandPaletteIndex >= filteredCommandPaletteItems.length) {
      setCommandPaletteIndex(0);
    }
  }, [commandPaletteIndex, filteredCommandPaletteItems.length]);

  const executeCommandPaletteItem = (item: CommandPaletteItem) => {
    item.run();
    setIsCommandPaletteOpen(false);
    setCommandPaletteQuery('');
    setCommandPaletteIndex(0);
  };

  const openUrlInNewTab = (url: string) => {
    const chromeTabs = (
      globalThis as {
        chrome?: {
          tabs?: {
            create?: (createProperties: { url?: string; active?: boolean }, callback?: () => void) => void;
          };
        };
      }
    ).chrome?.tabs;

    if (chromeTabs?.create) {
      chromeTabs.create({ url, active: true });
      return;
    }

    globalThis.open?.(url, '_blank', 'noopener,noreferrer');
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
  const canAccessVault = !vaultPasscode || isVaultUnlocked;

  return (
    <div className="relative min-h-screen overflow-hidden text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          key={wallpaper}
          initial={{ scale: 1.02, opacity: 0.85 }}
          animate={{ scale: 1, opacity: 0.95 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${wallpaper})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/65" />
        <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.45)]" />
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

        <main className="futuristic-scrollbar flex-1 overflow-y-auto px-4 pb-16 pt-5 sm:px-8 lg:px-10 lg:pb-10 lg:pr-24">
          <div className="mx-auto w-full max-w-[1380px]">
            <div className="mb-4 rounded-xl border border-white/12 bg-black/24 px-3 py-2 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <Search size={16} className="text-slate-300" />
                <input
                  ref={linkSearchInputRef}
                  value={linkSearchQuery}
                  onChange={(event) => setLinkSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') {
                      return;
                    }

                    const topMatch = linkSearchResults[0];
                    if (!topMatch) {
                      return;
                    }

                    event.preventDefault();
                    openBookmarkUrl(topMatch.bookmark);
                  }}
                  placeholder="Search links and press Enter to open the top match"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-400"
                />
                {linkSearchQuery ? (
                  <button
                    type="button"
                    onClick={() => setLinkSearchQuery('')}
                    className="rounded-md border border-white/10 bg-black/20 p-1.5 text-slate-300 transition-colors hover:border-white/20 hover:bg-white/8"
                    aria-label="Clear link search"
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>
            </div>

            {linkSearchQuery.trim() ? (
              <section className="mb-6 rounded-xl border border-white/12 bg-black/24 p-3 backdrop-blur-sm">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
                  Link results
                </p>
                {linkSearchResults.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {linkSearchResults.map(({ boardTitle, bookmark }) => (
                      <button
                        key={`${boardTitle}-${bookmark.id}`}
                        type="button"
                        onClick={() => openBookmarkUrl(bookmark)}
                        className="inline-flex max-w-full items-center gap-1 rounded-lg border border-white/15 bg-white/6 px-2.5 py-1.5 text-xs text-slate-200 transition-colors hover:border-white/30 hover:bg-white/10"
                        title={`${bookmark.url} • ${boardTitle}`}
                      >
                        {bookmark.pinned ? <Pin size={11} className="text-[#ff9b58]" /> : null}
                        <span className="max-w-[180px] truncate">{bookmark.title}</span>
                        <span className="rounded bg-black/30 px-1 py-0.5 text-[10px] text-slate-300">
                          {boardTitle}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-300">No links found for “{linkSearchQuery.trim()}”.</p>
                )}
              </section>
            ) : null}

            {isSearchOpen ? (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 flex items-center gap-2 rounded-xl border border-white/12 bg-black/24 px-3 py-2 backdrop-blur-sm"
              >
                <Search size={16} className="text-slate-300" />
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
                  className="rounded-md border border-white/10 bg-black/20 p-1.5 text-slate-300 transition-colors hover:border-white/20 hover:bg-white/8"
                  aria-label="Close search"
                >
                  <X size={14} />
                </button>
              </motion.div>
            ) : null}

            {!searchQuery.trim() && recentLinks.length > 0 ? (
              <section className="mb-6">
                <div className="rounded-xl border border-white/12 bg-black/24 p-3 backdrop-blur-sm">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
                    <History size={13} className="text-[#ff9b58]" />
                    Recent
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentLinks.map(({ usage, bookmark }) => (
                      <button
                        key={`recent-${usage.url}`}
                        type="button"
                        onClick={() => openBookmarkUrl(bookmark)}
                        className="inline-flex max-w-full items-center gap-1 rounded-lg border border-white/15 bg-white/6 px-2.5 py-1.5 text-xs text-slate-200 transition-colors hover:border-white/30 hover:bg-white/10"
                        title={`${bookmark.url} • Opened ${usage.openCount} times`}
                      >
                        {bookmark.pinned ? <Pin size={11} className="text-[#ff9b58]" /> : null}
                        <span className="max-w-[180px] truncate">{bookmark.title}</span>
                        <span className="rounded bg-black/30 px-1 py-0.5 text-[10px] text-slate-300">
                          {usage.openCount}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            ) : null}

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <motion.section
                className={cn(
                  'grid w-full content-start gap-5',
                  layoutMode === 'grid'
                    ? 'grid-cols-[repeat(auto-fill,minmax(260px,1fr))]'
                    : 'grid-cols-1'
                )}
              >
                {visibleBoards.map((board) => (
                  <Board
                    key={board.id}
                    board={board}
                    viewMode={viewMode}
                    sizePreset={getBoardSizePreset(board.id)}
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
                    onBoardSizeChange={handleBoardSizeChange}
                    onResetBoardSize={handleResetBoardSize}
                    onToggleBoardPinned={handleToggleBoardPinned}
                    onEditBookmark={openEditBookmarkEditor}
                    onDeleteBookmark={handleDeleteBookmark}
                    onToggleBookmarkFavorite={handleToggleBookmarkFavorite}
                    onToggleBookmarkPinned={handleToggleBookmarkPinned}
                    onAttachBookmarkToVault={handleAttachBookmarkToVault}
                    getBookmarkAttachmentCount={getBookmarkAttachmentCount}
                    onOpenBookmark={handleOpenBookmark}
                  />
                ))}

                {!searchQuery.trim() && filterMode === 'all' ? (
                  <AddBoardCard onClick={openCreateBoardEditor} />
                ) : null}
              </motion.section>

              <DragOverlay>
                {activeDragLabel ? (
                  <div className="rounded-lg border border-white/20 bg-black/75 px-3 py-2 text-sm text-slate-100">
                    {activeDragLabel}
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>

            {visibleBoards.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-white/20 bg-black/20 p-6 text-center text-sm text-slate-300">
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
      {!isVaultVisible || !canAccessVault ? (
        <button
          type="button"
          onClick={() => {
            if (!canAccessVault) {
              setIsVaultUnlockModalOpen(true);
              setToast('Enter vault password');
              return;
            }

            setIsVaultVisible(true);
            setIsVaultMinimized(false);
          }}
          className="fixed bottom-4 left-4 z-40 rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-white/25 hover:bg-white/10 sm:bottom-5 sm:left-5"
        >
          {canAccessVault ? 'Open Vault' : 'Vault Locked'}
        </button>
      ) : null}

      <Modal
        isOpen={isVaultUnlockModalOpen}
        title="Unlock Vault"
        description="Enter your vault password to open the vault board."
        onClose={() => setIsVaultUnlockModalOpen(false)}
      >
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void handleUnlockVault();
          }}
        >
          <input
            type="password"
            value={vaultUnlockDraft}
            onChange={(event) => setVaultUnlockDraft(event.target.value)}
            placeholder="Enter vault password"
            className="w-full rounded-lg border border-white/15 bg-black/25 px-2.5 py-2 text-xs text-slate-100 outline-none transition-colors focus:border-white/30"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-lg border border-white/15 bg-white/8 px-3 py-2 text-xs text-slate-200 transition-colors hover:bg-white/14"
            >
              Unlock
            </button>
          </div>
        </form>
      </Modal>

      {isVaultVisible && canAccessVault ? (
        <VaultPanel
          key={vaultPrefillDraft?.token ?? 'vault-panel'}
          entries={vaultEntries}
          position={vaultPosition}
          isMinimized={isVaultMinimized}
          onPositionChange={setVaultPosition}
          onToggleMinimize={() => setIsVaultMinimized((value) => !value)}
          onLock={handleVaultHeaderLock}
          onAddEntry={handleAddVaultEntry}
          onDeleteEntry={handleDeleteVaultEntry}
          onOpenWebsite={handleOpenVaultWebsite}
          onCopyValue={handleCopyVaultValue}
          prefillDraft={vaultPrefillDraft}
          onHide={() => setIsVaultVisible(false)}
        />
      ) : null}
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
        isOpen={isCommandPaletteOpen}
        title="Command Palette"
        description="Quick actions, page jumps, and instant link opening."
        onClose={() => setIsCommandPaletteOpen(false)}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl border border-white/12 bg-black/30 px-3 py-2">
            <Command size={15} className="text-[#ff9b58]" />
            <input
              ref={commandPaletteInputRef}
              value={commandPaletteQuery}
              onChange={(event) => {
                setCommandPaletteQuery(event.target.value);
                setCommandPaletteIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setCommandPaletteIndex((index) =>
                    filteredCommandPaletteItems.length === 0
                      ? 0
                      : (index + 1) % filteredCommandPaletteItems.length
                  );
                }

                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  setCommandPaletteIndex((index) => {
                    if (filteredCommandPaletteItems.length === 0) {
                      return 0;
                    }

                    return index <= 0 ? filteredCommandPaletteItems.length - 1 : index - 1;
                  });
                }

                if (event.key === 'Enter') {
                  event.preventDefault();
                  const item = filteredCommandPaletteItems[commandPaletteIndex];
                  if (item) {
                    executeCommandPaletteItem(item);
                  }
                }
              }}
              placeholder="Type a command or link name..."
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-400"
            />
          </div>

          <div className="futuristic-scrollbar max-h-72 space-y-1 overflow-y-auto pr-1">
            {filteredCommandPaletteItems.length > 0 ? (
              filteredCommandPaletteItems.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => executeCommandPaletteItem(item)}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 text-left transition-colors',
                    index === commandPaletteIndex
                      ? 'border-[#ff6a00]/60 bg-[#ff6a00]/15'
                      : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                  )}
                >
                  <p className="text-sm font-medium text-slate-100">{item.label}</p>
                  <p className="truncate text-xs text-slate-300">{item.description}</p>
                </button>
              ))
            ) : (
              <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-300">
                No matches. Try another command keyword.
              </p>
            )}
          </div>
        </div>
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
        <input
          ref={wallpaperInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              handleWallpaperUpload(file);
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
            onClick={() => wallpaperInputRef.current?.click()}
            className="flex w-full items-center gap-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-left text-sm text-slate-200 transition-colors hover:bg-white/10"
          >
            <Upload size={16} className="text-[#ff9b58]" />
            Upload wallpaper
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

          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Vault Password</p>
            <p className="mb-3 text-[11px] text-slate-400">
              Keep vault hidden and unlock with a password. Stored locally in your browser data.
            </p>

            <div className="mb-2 flex gap-2">
              <input
                type="password"
                value={vaultPasscodeDraft}
                onChange={(event) => setVaultPasscodeDraft(event.target.value)}
                placeholder={vaultPasscode ? 'Change vault password' : 'Set vault password'}
                className="w-full rounded-lg border border-white/15 bg-black/25 px-2.5 py-2 text-xs text-slate-100 outline-none transition-colors focus:border-white/30"
              />
              <button
                type="button"
                onClick={handleSaveVaultPasscode}
                className="rounded-lg border border-white/15 bg-white/8 px-3 py-2 text-xs text-slate-200 transition-colors hover:bg-white/14"
              >
                {vaultPasscode ? 'Update' : 'Set'}
              </button>
            </div>

            {vaultPasscode ? (
              <>
                {isVaultUnlocked ? (
                  <button
                    type="button"
                    onClick={handleLockVault}
                    className="mb-2 rounded-lg border border-white/15 bg-white/8 px-3 py-2 text-xs text-slate-200 transition-colors hover:bg-white/14"
                  >
                    Lock vault now
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={handleRemoveVaultPasscode}
                  className="mb-2 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-200 transition-colors hover:bg-red-500/20"
                >
                  Remove vault password
                </button>
              </>
            ) : null}

            <button
              type="button"
              onClick={handleToggleVaultVisibility}
              className="w-full rounded-lg border border-white/15 bg-white/8 px-3 py-2 text-xs text-slate-200 transition-colors hover:bg-white/14"
            >
              {isVaultVisible && canAccessVault ? 'Hide vault board' : 'Show vault board'}
            </button>
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
