import type { RunStreamEvent } from "@ship-council/shared";

type StreamListener = (event: RunStreamEvent) => void;

const listenersBySession = new Map<string, Set<StreamListener>>();
const historyBySession = new Map<string, RunStreamEvent[]>();

const MAX_EVENT_HISTORY = 200;

export function resetRunStream(sessionId: string): void {
  historyBySession.set(sessionId, []);
}

export function publishRunStreamEvent(event: RunStreamEvent): void {
  const history = historyBySession.get(event.sessionId) ?? [];
  history.push(event);
  historyBySession.set(event.sessionId, history.slice(-MAX_EVENT_HISTORY));

  const listeners = listenersBySession.get(event.sessionId);
  if (!listeners) {
    return;
  }

  for (const listener of listeners) {
    listener(event);
  }
}

export function subscribeToRunStream(sessionId: string, listener: StreamListener): () => void {
  const listeners = listenersBySession.get(sessionId) ?? new Set<StreamListener>();
  listeners.add(listener);
  listenersBySession.set(sessionId, listeners);

  const history = historyBySession.get(sessionId) ?? [];
  for (const event of history) {
    listener(event);
  }

  return () => {
    const active = listenersBySession.get(sessionId);
    if (!active) {
      return;
    }

    active.delete(listener);
    if (active.size === 0) {
      listenersBySession.delete(sessionId);
    }
  };
}
