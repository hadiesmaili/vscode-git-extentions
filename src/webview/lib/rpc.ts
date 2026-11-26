import type { HostEvent, HostMessage, Method, Params, RequestMessage, Result } from '../../shared/protocol';

interface VsCodeApi {
  postMessage(m: unknown): void;
  getState<T>(): T | undefined;
  setState<T>(s: T): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

export const vscode = acquireVsCodeApi();

let seq = 0;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
const listeners = new Set<(e: HostEvent) => void>();

window.addEventListener('message', (ev: MessageEvent<HostMessage>) => {
  const m = ev.data;
  if (!m || typeof m !== 'object') return;
  if (m.kind === 'response') {
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    if (m.ok) p.resolve(m.result);
    else p.reject(new Error(m.error ?? 'Request failed'));
  } else if (m.kind === 'event') {
    listeners.forEach((l) => l(m));
  }
});

/** Typed call into the extension host. */
export function call<M extends Method>(method: M, ...params: Params<M> extends undefined ? [] : [Params<M>]): Promise<Awaited<Result<M>>> {
  const id = ++seq;
  const msg: RequestMessage = { kind: 'request', id, method, params: params[0] };
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    vscode.postMessage(msg);
  });
}

export function onEvent(l: (e: HostEvent) => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Fire-and-forget call; errors are already reported by the host. */
export function act<M extends Method>(method: M, ...params: Params<M> extends undefined ? [] : [Params<M>]): void {
  call(method, ...params).catch(() => undefined);
}
