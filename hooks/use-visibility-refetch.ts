'use client'

/**
 * @file use-visibility-refetch.ts
 * @description React hook that calls a refetch function whenever the document
 *   transitions to "visible". Used to reconcile state that the Realtime
 *   WebSocket may have missed while the tab was backgrounded and the
 *   heartbeat suspended (master plan §11).
 *   Called by: hooks/use-messages.ts, components/chat-panel/chat-panel-provider.tsx
 */

import { useEffect } from 'react'

/**
 * Subscribes to the document.visibilitychange event and invokes refetch whenever
 * the tab becomes visible. Cleanup removes the listener on unmount.
 * @param refetch - Callback to invoke; useCallback recommended to avoid rebinding
 * @called-by hooks/use-messages.ts (chat thread reconciliation), chat-panel-provider (auto-open list reconciliation)
 */
export function useVisibilityRefetch(refetch: () => void | Promise<void>): void {
  useEffect(() => {
    function handler() {
      if (document.visibilityState === 'visible') {
        void refetch()
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => {
      document.removeEventListener('visibilitychange', handler)
    }
  }, [refetch])
}
