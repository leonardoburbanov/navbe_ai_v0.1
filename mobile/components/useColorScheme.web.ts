import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * Web: follow system preference after mount (SSR stays light to avoid hydration mismatch).
 */
export function useColorScheme(): 'light' | 'dark' {
  const [hasHydrated, setHasHydrated] = useState(false);
  const scheme = useRNColorScheme();

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  if (!hasHydrated) {
    return 'light';
  }
  return scheme === 'dark' ? 'dark' : 'light';
}
