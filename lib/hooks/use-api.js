"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** fetch() wrapper: JSON in/out, throws Error(message) on !ok. */
export async function apiFetch(url, { body, method, headers, signal } = {}) {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const res = await fetch(url, {
    method: method || (body ? "POST" : "GET"),
    cache: "no-store",
    signal,
    headers: { ...(body && !isForm ? { "Content-Type": "application/json" } : {}), ...headers },
    ...(body ? { body: isForm ? body : JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    const err = new Error(json.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = json;
    throw err;
  }
  return json;
}

/**
 * Data loader without setState-in-effect cascades.
 * `loading` is derived (state.key !== current key), so the effect only
 * sets state after the request resolves.
 *   const { data, error, loading, reload, mutate } = useApi(`/api/x?range=${r}`);
 */
export function useApi(url, { initialData } = {}) {
  const [nonce, setNonce] = useState(0);
  const key = url ? `${url}#${nonce}` : null;
  const hasInitial = initialData !== undefined;
  const skipFirst = useRef(hasInitial);
  const [state, setState] = useState(() => ({
    key: hasInitial ? key : null,
    data: hasInitial ? initialData : null,
    error: null,
  }));

  useEffect(() => {
    if (!url) return undefined;
    if (skipFirst.current) {
      skipFirst.current = false;
      return undefined;
    }
    const ac = new AbortController();
    apiFetch(url, { signal: ac.signal }).then(
      (data) => setState({ key, data, error: null }),
      (err) => {
        if (err?.name === "AbortError") return;
        setState((s) => ({ key, data: s.data, error: err?.message || "Failed to load." }));
      },
    );
    return () => ac.abort();
  }, [key, url]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const mutate = useCallback(
    (next) => setState((s) => ({ ...s, data: typeof next === "function" ? next(s.data) : next })),
    [],
  );

  return {
    data: state.data,
    error: state.error,
    loading: Boolean(url) && state.key !== key,
    reload,
    mutate,
  };
}
