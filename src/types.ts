export type LayoutMode = 'grid' | 'list';
export type ViewMode = 'comfortable' | 'compact';
export type FilterMode = 'all' | 'favorites';
export type AmbientSoundPreset = 'off' | 'rain' | 'thunderstorm' | 'ocean' | 'wind';
export type BoardSizePreset = 'compact' | 'normal' | 'expanded';

export interface Position2D {
  x: number;
  y: number;
}

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  icon?: string;
  favorite: boolean;
  pinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BoardType {
  id: string;
  title: string;
  pinned?: boolean;
  bookmarks: Bookmark[];
}

export interface LinkUsageEntry {
  url: string;
  title: string;
  openCount: number;
  lastOpenedAt: string;
}

export interface PageType {
  id: string;
  title: string;
  boards: BoardType[];
}

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

export interface VaultEntry {
  id: string;
  title: string;
  username: string;
  password: string;
  website?: string;
  linkedBookmarkUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppData {
  pages: PageType[];
  activePageId: string;
  wallpaper: string;
  layoutMode: LayoutMode;
  viewMode: ViewMode;
  filterMode: FilterMode;
  isIncognito: boolean;
  todos: TodoItem[];
  vaultEntries: VaultEntry[];
  vaultPasscode: string;
  isVaultVisible: boolean;
  boardPositions: Record<string, Position2D>;
  boardSizes: Record<string, BoardSizePreset>;
  linkUsage: Record<string, LinkUsageEntry>;
  minimizedBoardIds: string[];
  todoPosition: Position2D;
  vaultPosition: Position2D;
  clockPosition: Position2D;
  isTodoMinimized: boolean;
  isVaultMinimized: boolean;
  isClockMinimized: boolean;
  soundPreset: AmbientSoundPreset;
  soundVolume: number;
  isSoundEnabled: boolean;
}

export interface QuickSavedLink {
  id?: string;
  title?: string;
  url?: string;
  createdAt?: string;
}
