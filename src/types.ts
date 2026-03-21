export type LayoutMode = 'grid' | 'list';
export type ViewMode = 'comfortable' | 'compact';
export type FilterMode = 'all' | 'favorites';
export type AmbientSoundPreset = 'off' | 'rain' | 'thunderstorm' | 'ocean' | 'wind';

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
  createdAt: string;
  updatedAt: string;
}

export interface BoardType {
  id: string;
  title: string;
  bookmarks: Bookmark[];
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

export interface AppData {
  pages: PageType[];
  activePageId: string;
  wallpaper: string;
  layoutMode: LayoutMode;
  viewMode: ViewMode;
  filterMode: FilterMode;
  isIncognito: boolean;
  todos: TodoItem[];
  boardPositions: Record<string, Position2D>;
  minimizedBoardIds: string[];
  todoPosition: Position2D;
  clockPosition: Position2D;
  isTodoMinimized: boolean;
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
