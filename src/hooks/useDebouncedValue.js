import { useEffect, useState } from 'react';

/**
 * Renvoie une valeur "retardée" qui ne change qu'après `delay` ms sans modification.
 * Utile pour éviter de refiltrer/refetch à chaque touche dans une recherche.
 *
 * @example
 * const [search, setSearch] = useState('');
 * const debouncedSearch = useDebouncedValue(search, 300);
 * useEffect(() => { fetch(`/api?q=${debouncedSearch}`) }, [debouncedSearch]);
 */
export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}

export default useDebouncedValue;
