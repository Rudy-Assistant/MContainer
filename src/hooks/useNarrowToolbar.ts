import { useState, useEffect } from 'react';

const NARROW_BREAKPOINT = 1200;

/** Returns true when viewport width is below 1200px — toolbar should use compact labels */
export function useNarrowToolbar(): boolean {
  const [narrow, setNarrow] = useState(
    typeof window !== 'undefined' ? window.innerWidth < NARROW_BREAKPOINT : false
  );

  useEffect(() => {
    const handler = () => setNarrow(window.innerWidth < NARROW_BREAKPOINT);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return narrow;
}
