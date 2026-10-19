import { useEffect, useRef, useState } from 'react';

import { getRouteKey } from '../data/secrets';
import type { LatLng } from './geo';
import { placeIfAllowed } from './location';
import { useOnline } from './network';
import {
  fetchSuggestions,
  phoneCountry,
  queryFor,
  SuggestError,
  suggestSource,
  type Suggestion,
  type SuggestSource,
} from './suggest';

/** Typing is let settle this long before anything is sent. */
const SETTLE_MS = 350;

export type SuggestState = {
  list: Suggestion[];
  /** Where `list` came from. */
  source: SuggestSource;
  status: 'idle' | 'looking' | 'done' | 'offline' | 'failed';
};

const IDLE: SuggestState = { list: [], source: 'photon', status: 'idle' };

/**
 * Suggestions for what is typed, while `active` (the field is being typed in). Only the
 * newest answer is shown: an older one arriving late is dropped. If openrouteservice
 * refuses the key or is out of routes for now, Photon answers instead.
 */
export function useAddressSuggestions(text: string, active: boolean): SuggestState {
  // Each answer is kept with the question it answers, so one for older text is never shown.
  const [state, setState] = useState<SuggestState & { query: string | null }>({ ...IDLE, query: null });
  const online = useOnline();
  const current = active ? queryFor(text) : null;
  // Read once, on first use: the key and roughly where the owner is, if already allowed.
  const context = useRef<Promise<{ key: string | null; near: LatLng | null }> | null>(null);

  useEffect(() => {
    const query = current;
    // Offline: nothing is sent, and the list says so at once (below).
    if (!query || !online) return;
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      context.current ??= Promise.all([getRouteKey(), placeIfAllowed()]).then(([key, near]) => ({ key, near }));
      const { key, near } = await context.current;
      if (abort.signal.aborted) return;
      let source = suggestSource(key);
      setState((s) => ({ ...s, source, status: 'looking', query }));
      const ask = (from: SuggestSource) =>
        fetchSuggestions(from, query, { key, near, homeCountry: phoneCountry(), signal: abort.signal });
      try {
        let list: Suggestion[];
        try {
          list = await ask(source);
        } catch (error) {
          const problem = error instanceof SuggestError ? error.problem : null;
          if (source !== 'openrouteservice' || (problem !== 'badKey' && problem !== 'quota')) throw error;
          source = 'photon';
          list = await ask(source);
        }
        if (!abort.signal.aborted) setState({ list, source, status: 'done', query });
      } catch (error) {
        if (abort.signal.aborted) return;
        const offline = error instanceof SuggestError && error.problem === 'offline';
        setState({ list: [], source, status: offline ? 'offline' : 'failed', query });
      }
    }, SETTLE_MS);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [current, online]);

  if (!current) return IDLE;
  if (!online) return { list: [], source: state.source, status: 'offline' };
  // While the newest text is still settling, the last list stays up so it does not flicker.
  return { list: state.list, source: state.source, status: state.query === current ? state.status : 'looking' };
}
