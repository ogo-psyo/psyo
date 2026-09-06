'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { applyLibraryCommand, emptyMapLibrary, type LibraryCommand, type MapLibrary } from '@/lib/mapLibrary';
export function useMapLibrary(petId: string, guest: boolean, headers: () => Record<string, string>) {
    const [library, setLibrary] = useState<MapLibrary>(emptyMapLibrary);
    const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const pending = useRef<{
        signature: string;
        command: LibraryCommand;
    } | null>(null);
    const lock = useRef(false), current = useRef(library), headersRef = useRef(headers), petRef = useRef(petId);
    useLayoutEffect(() => { headersRef.current = headers; petRef.current = petId; }, [headers, petId]);
    const key = `pso.map.library.v1:${petId}`;
    const reload = useCallback(async (signal?: AbortSignal) => {
        setState('loading');
        try {
            let next: MapLibrary;
            if (guest) {
                const raw = localStorage.getItem(key);
                next = raw ? JSON.parse(raw) : emptyMapLibrary();
                if (!Array.isArray(next.places) || !Array.isArray(next.collections))
                    throw new Error();
            }
            else {
                const response = await fetch(`/api/map/library?petId=${encodeURIComponent(petId)}`, { credentials: 'include', headers: headersRef.current(), signal });
                if (!response.ok)
                    throw new Error();
                next = (await response.json()).library;
            }
            if (signal?.aborted || petRef.current !== petId)
                return;
            current.current = next;
            setLibrary(next);
            setState('ready');
            setError('');
        }
        catch {
            if (signal?.aborted)
                return;
            setState('error');
            setError('Подборки не загрузились. Повторите — сохранённые данные не удалены.');
        }
    }, [petId, guest, key]);
    useEffect(() => { const controller = new AbortController(); void Promise.resolve().then(() => reload(controller.signal)); return () => controller.abort(); }, [reload]);
    const mutate = useCallback(async (command: LibraryCommand): Promise<MapLibrary | null> => {
        if (lock.current || state !== 'ready')
            return null;
        lock.current = true;
        setBusy(true);
        setError('');
        const semantic = { ...command, id: undefined, ...(command.kind === 'createCollection' ? { collectionId: undefined } : {}), ...(command.kind === 'savePlace' ? { place: { ...command.place, id: undefined } } : {}) };
        const signature = JSON.stringify(semantic);
        if (pending.current?.signature !== signature)
            pending.current = { signature, command };
        const attempt = pending.current.command;
        try {
            let next: MapLibrary;
            if (guest) {
                next = applyLibraryCommand(current.current, attempt);
                localStorage.setItem(key, JSON.stringify(next));
            }
            else {
                const response = await fetch('/api/map/library', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', ...headersRef.current() }, body: JSON.stringify({ petId, command: attempt }) });
                if (!response.ok)
                    throw new Error();
                next = (await response.json()).library;
            }
            if (petRef.current !== petId)
                return null;
            pending.current = null;
            current.current = next;
            setLibrary(next);
            return next;
        }
        catch {
            setError('Сохранение не подтверждено. Ввод оставлен; повторите действие.');
            return null;
        }
        finally {
            lock.current = false;
            setBusy(false);
        }
    }, [guest, key, petId, state]);
    return { library, state, error, busy, reload, mutate };
}
export type MapLibraryStore = ReturnType<typeof useMapLibrary>;
