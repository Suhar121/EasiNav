import type { UniqueIdentifier } from '@dnd-kit/core';

const BOARD_PREFIX = 'board:';
const BOOKMARK_PREFIX = 'bookmark:';

export const boardDndId = (boardId: string) => `${BOARD_PREFIX}${boardId}`;
export const bookmarkDndId = (bookmarkId: string) => `${BOOKMARK_PREFIX}${bookmarkId}`;

export const isBoardDndId = (value: UniqueIdentifier | null | undefined): boolean =>
  typeof value === 'string' && value.startsWith(BOARD_PREFIX);

export const isBookmarkDndId = (value: UniqueIdentifier | null | undefined): boolean =>
  typeof value === 'string' && value.startsWith(BOOKMARK_PREFIX);

export const extractBoardId = (value: UniqueIdentifier): string =>
  String(value).replace(BOARD_PREFIX, '');

export const extractBookmarkId = (value: UniqueIdentifier): string =>
  String(value).replace(BOOKMARK_PREFIX, '');
