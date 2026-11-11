'use client';
/**
 * Resource metadata (from /api/meta, introspected from Oracle) and FK lookup
 * lists, cached for the session so forms/tables don't refetch constantly.
 */
import { useEffect, useState } from 'react';
import { api } from './api';

let metaPromise = null;
const lookupCache = new Map();

export function resetMetaCache() {
  metaPromise = null;
  lookupCache.clear();
}

export function useMeta() {
  const [state, setState] = useState({ meta: null, error: null });
  useEffect(() => {
    let alive = true;
    metaPromise ||= api('/meta').catch((e) => { metaPromise = null; throw e; });
    metaPromise.then((meta) => alive && setState({ meta, error: null }), (error) => alive && setState({ meta: null, error }));
    return () => { alive = false; };
  }, []);
  return state;
}

export function invalidateLookup(resource) {
  lookupCache.delete(resource);
}

export function useLookup(resource) {
  const [options, setOptions] = useState(null);
  useEffect(() => {
    if (!resource) return undefined;
    let alive = true;
    if (!lookupCache.has(resource)) {
      lookupCache.set(resource, api(`/lookups/${resource}`).catch((e) => { lookupCache.delete(resource); throw e; }));
    }
    lookupCache.get(resource).then((o) => alive && setOptions(o), () => alive && setOptions([]));
    return () => { alive = false; };
  }, [resource]);
  return options;
}

/** FK columns that appear on read-only views (no table metadata to introspect). */
export const VIEW_FK = { zone_id: 'zones', dept_id: 'departments', pole_id: 'streetlights', cabinet_id: 'feeder-pillars' };
/** Enums on derived view columns (not backed by a CHECK constraint). */
export const VIEW_ENUMS = { stock_level: ['OK', 'LOW', 'OUT_OF_STOCK'] };
