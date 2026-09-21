import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Documento de estado compartilhado entre todos os aparelhos da equipe (ver server/stateService.ts).
 *
 * - Lê o valor do servidor ao entrar e o mantém atualizado (evento em tempo real + verificação
 *   periódica de segurança).
 * - `setValue` aceita valor ou função (como o useState). Cada alteração é aplicada na hora
 *   na tela e enviada ao servidor em segundo plano.
 * - Se outro aparelho gravou antes (HTTP 409), a alteração é REAPLICADA sobre o valor mais novo
 *   do servidor. Assim duas pessoas lançando movimentos no caixa ao mesmo tempo não se sobrescrevem.
 */

type Updater<T> = T | ((prev: T) => T);

interface Options {
  /** só carrega/grava quando true (ex.: colaborador logado) */
  enabled: boolean;
  onError?: (message: string) => void;
}

// ---- verificação periódica compartilhada (fallback quando o tempo real cai) ----
let pollerTimer: any = null;
let pollerUsers = 0;
const knownVersions: Record<string, number> = {};

async function pollVersions() {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
  try {
    const res = await fetch('/api/state');
    if (!res.ok) return;
    const data = await res.json();
    for (const [key, version] of Object.entries<number>(data.versions || {})) {
      if (knownVersions[key] !== undefined && knownVersions[key] !== version) {
        window.dispatchEvent(new CustomEvent('nx-state-updated', { detail: { key, version } }));
      }
      knownVersions[key] = version;
    }
  } catch {
    /* offline: tenta de novo no próximo ciclo */
  }
}

function startPoller() {
  pollerUsers += 1;
  if (!pollerTimer) pollerTimer = setInterval(pollVersions, 15000);
}
function stopPoller() {
  pollerUsers = Math.max(0, pollerUsers - 1);
  if (pollerUsers === 0 && pollerTimer) {
    clearInterval(pollerTimer);
    pollerTimer = null;
  }
}

export function useServerDoc<T>(key: string, initial: T, opts: Options) {
  const { enabled } = opts;
  const [value, setValueState] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);

  const valueRef = useRef<T>(initial);
  const versionRef = useRef(0);
  const queueRef = useRef<Array<(prev: T) => T>>([]);
  const timerRef = useRef<any>(null);
  const flushingRef = useRef(false);
  const deniedRef = useRef(false);
  const loadedRef = useRef(false);
  const onErrorRef = useRef(opts.onError);
  onErrorRef.current = opts.onError;
  const initialRef = useRef(initial);

  const apply = (base: T) => queueRef.current.reduce((v, fn) => fn(v), base);

  const flush = useCallback(async (attempt = 0): Promise<void> => {
    if (flushingRef.current || queueRef.current.length === 0 || !loadedRef.current || deniedRef.current) return;
    flushingRef.current = true;
    const sentCount = queueRef.current.length;
    try {
      const res = await fetch(`/api/state/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: valueRef.current, baseVersion: versionRef.current }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        versionRef.current = data.version;
        knownVersions[key] = data.version;
        queueRef.current.splice(0, sentCount);
      } else if (res.status === 409 && attempt < 5) {
        // Outro aparelho gravou antes: reaplica as alterações locais sobre o valor mais novo
        versionRef.current = data.version ?? 0;
        const base = (data.value ?? initialRef.current) as T;
        valueRef.current = apply(base);
        setValueState(valueRef.current);
        flushingRef.current = false;
        return flush(attempt + 1);
      } else if (res.status === 401) {
        queueRef.current = [];
      } else if (res.status === 403) {
        deniedRef.current = true;
        queueRef.current = [];
        onErrorRef.current?.('Seu perfil não tem permissão para salvar esta informação.');
      } else {
        onErrorRef.current?.(data.error || `Não foi possível salvar (erro ${res.status}).`);
        queueRef.current = [];
      }
    } catch {
      // sem conexão: mantém a fila e tenta de novo em instantes
      flushingRef.current = false;
      timerRef.current = setTimeout(() => flush(), 5000);
      return;
    }
    flushingRef.current = false;
    if (queueRef.current.length > 0) flush();
  }, [key]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/state/${key}`);
      if (res.status === 403 || res.status === 404) {
        deniedRef.current = true;
        loadedRef.current = true;
        setLoaded(true);
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      versionRef.current = data.version ?? 0;
      knownVersions[key] = data.version ?? 0;
      const isPlain = (v: unknown) => v !== null && typeof v === 'object' && !Array.isArray(v);
      const base = (
        data.exists
          ? isPlain(initialRef.current) && isPlain(data.value)
            ? { ...(initialRef.current as object), ...(data.value as object) } // campos novos ganham o padrão
            : data.value
          : initialRef.current
      ) as T;
      // alterações feitas antes de terminar de carregar continuam valendo, por cima do servidor
      valueRef.current = apply(base);
      setValueState(valueRef.current);
      loadedRef.current = true;
      setLoaded(true);
      if (queueRef.current.length > 0) flush();
    } catch {
      /* servidor indisponível: mantém o valor inicial e tenta no próximo evento */
    }
  }, [key, flush]);

  // carga inicial + tempo real
  useEffect(() => {
    if (!enabled) {
      loadedRef.current = false;
      deniedRef.current = false;
      versionRef.current = 0;
      queueRef.current = [];
      valueRef.current = initialRef.current;
      setValueState(initialRef.current);
      setLoaded(false);
      return undefined;
    }
    load();
    startPoller();
    const onUpdated = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.key !== key || deniedRef.current) return;
      if (typeof d.version === 'number' && d.version <= versionRef.current) return;
      if (queueRef.current.length === 0 && !flushingRef.current) load();
    };
    window.addEventListener('nx-state-updated', onUpdated);
    return () => {
      window.removeEventListener('nx-state-updated', onUpdated);
      stopPoller();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, key, load]);

  const setValue = useCallback(
    (u: Updater<T>) => {
      if (!enabled) {
        // sem login: apenas estado local (não grava nada no servidor)
        const fn = typeof u === 'function' ? (u as (p: T) => T) : () => u;
        valueRef.current = fn(valueRef.current);
        setValueState(valueRef.current);
        return;
      }
      const fn = typeof u === 'function' ? (u as (p: T) => T) : () => u;
      const next = fn(valueRef.current);
      if (Object.is(next, valueRef.current)) return; // nada mudou: não grava
      valueRef.current = next;
      setValueState(valueRef.current);
      queueRef.current.push(fn);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => flush(), 350);
    },
    [enabled, flush]
  );

  return [value, setValue, { loaded, version: versionRef }] as const;
}
