'use client';
import { createContext, useContext } from 'react';

type ThumbnailMap = Map<string, string>;
const BlockThumbnailCtx = createContext<ThumbnailMap>(new Map());

export function BlockThumbnailProvider({ children, thumbnails }: {
  children: React.ReactNode;
  thumbnails: ThumbnailMap;
}) {
  return (
    <BlockThumbnailCtx.Provider value={thumbnails}>
      {children}
    </BlockThumbnailCtx.Provider>
  );
}

/** Get cached data URL for a block preset thumbnail. Returns undefined if not yet rendered. */
export function useBlockThumbnail(presetId: string): string | undefined {
  const map = useContext(BlockThumbnailCtx);
  return map.get(presetId);
}
