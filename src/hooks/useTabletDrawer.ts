import { useState, useEffect } from 'react';

/** Below this width the sidebar overlays the canvas as a slide-in drawer
 *  instead of reserving a hard-coded 384px column. */
const DRAWER_BREAKPOINT = 1024;

/** Returns true when the sidebar should behave as an overlay drawer
 *  (tablet + narrow-desktop). Safe for SSR — returns false on the server. */
export function useTabletDrawer(): boolean {
  const [isDrawer, setIsDrawer] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < DRAWER_BREAKPOINT : false
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${DRAWER_BREAKPOINT - 1}px)`);
    const update = () => setIsDrawer(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return isDrawer;
}
