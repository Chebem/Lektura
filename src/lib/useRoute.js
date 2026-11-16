import { useCallback, useEffect, useState } from 'react';

/**
 * Two routes don't justify React Router. This keeps the URL in sync with the
 * History API so back/forward and a shareable /study path behave normally;
 * Vite's dev server already falls back to index.html for unknown paths.
 */
export const ROUTES = {
  home: '/',
  study: '/study',
};

export function useRoute() {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to, { replace = false } = {}) => {
    if (to !== window.location.pathname) {
      window.history[replace ? 'replaceState' : 'pushState'](null, '', to);
    }
    setPath(to);
    window.scrollTo(0, 0);
  }, []);

  return [path, navigate];
}
