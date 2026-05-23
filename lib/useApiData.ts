"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiAuthGet, UnauthorizedError } from "./api";
import { useAuth } from "../context/AuthContext";

export interface UseApiDataResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  // Returns a Promise<void> that resolves after fresh data has been set in
  // state. Callers can await it so mutation forms dismiss only once the list
  // already reflects the change — no manual page refresh needed.
  reload: () => Promise<void>;
}

/**
 * Generic authenticated data-fetch hook. Re-usable across all feature slices.
 * - Uses apiAuthGet (Bearer token attached automatically).
 * - On 401 → calls logout() and redirects; no error state set.
 * - No fetch timeout — tolerates Render free-tier cold starts (up to 60s).
 * - Keeps stale data visible while a background reload is in flight.
 * - Must be used inside <AuthProvider>.
 */
export function useApiData<T = unknown>(path: string): UseApiDataResult<T> {
  const { logout } = useAuth();

  // Keep logout in a ref so effects never need it as a dep.
  const logoutRef = useRef(logout);
  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initial fetch (and re-fetch when path changes). The cancelled flag
  // prevents stale state updates if the component unmounts mid-flight.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiAuthGet<T>(path)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof UnauthorizedError) {
          logoutRef.current();
          return; // navigating away — no state updates
        }
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  // reload() performs the fetch directly rather than bumping a version counter.
  // This means the returned Promise resolves only after setData has been called,
  // so awaiting reload() guarantees the list is up-to-date before the caller
  // proceeds (e.g. dismissing a form or clearing a delete target).
  const reload = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiAuthGet<T>(path);
      setData(result);
      setLoading(false);
    } catch (e: unknown) {
      if (e instanceof UnauthorizedError) {
        logoutRef.current();
        return; // navigating away — no state updates
      }
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  return { data, loading, error, reload };
}
