import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useDebouncedValue } from "@shared/hooks/useDebouncedValue";

/**
 * Reads and writes a single URL query parameter, so a search term survives a
 * reload and can be shared as a link.
 *
 * Writes use `replace` — a search box calls this on every keystroke,
 * and pushing each one would turn the browser Back button into an undo of the
 * user's typing instead of a way off the page. The key is deleted rather than
 * set to an empty string so a cleared field leaves a clean URL.
 */
export function useSearchParam(key = "search") {
  const [searchParams, setSearchParams] = useSearchParams();
  const value = searchParams.get(key) ?? "";

  const setValue = useCallback(
    (next: string) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next) params.set(key, next);
          else params.delete(key);
          return params;
        },
        { replace: true },
      );
    },
    [key, setSearchParams],
  );

  return [value, setValue] as const;
}

/**
 * A search box backed by `useSearchParam`.
 *
 * The URL owns the input, including history navigation. Typing replaces it
 * immediately; only the API search term is debounced.
 */
export function useDebouncedSearchParam(key = "search", delay = 300) {
  const [input, setInput] = useSearchParam(key);
  const search = useDebouncedValue(input, delay);
  return { input, setInput, search };
}
