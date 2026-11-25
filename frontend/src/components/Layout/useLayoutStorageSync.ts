import { useEffect, useRef } from 'react'

/**
 * Apply layout changes written by another tab. `onExternal` runs only for the
 * matching key; the ref keeps the listener stable while still seeing the
 * latest callback.
 */
export function useLayoutStorageSync(storageKey: string, onExternal: (newValue: string | null) => void) {
  const handlerRef = useRef(onExternal)
  handlerRef.current = onExternal

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return
      handlerRef.current(event.newValue)
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [storageKey])
}
