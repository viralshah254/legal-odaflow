"use client"

import { useCallback, useEffect, useRef, useState } from "react"

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface AutosaveOptions {
  debounceMs?: number
  enabled?: boolean
}

interface AutosaveResult {
  status: SaveStatus
  lastSavedAt?: Date
  save: () => Promise<void>
}

export function useAutosave<T>(
  value: T,
  onSave: (value: T) => Promise<void>,
  options: AutosaveOptions = {},
): AutosaveResult {
  const { debounceMs = 2000, enabled = true } = options

  const [status, setStatus] = useState<SaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<Date | undefined>()

  const onSaveRef = useRef(onSave)
  useEffect(() => { onSaveRef.current = onSave }, [onSave])

  const valueRef = useRef(value)
  useEffect(() => { valueRef.current = value }, [value])

  const isMounted = useRef(true)
  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  const save = useCallback(async (): Promise<void> => {
    if (!isMounted.current) return
    setStatus('saving')
    try {
      await onSaveRef.current(valueRef.current)
      if (!isMounted.current) return
      setStatus('saved')
      setLastSavedAt(new Date())
    } catch {
      if (!isMounted.current) return
      setStatus('error')
    }
  }, [])

  // Mark dirty (idle → will save soon) whenever value changes
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitialMount = useRef(true)

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    if (!enabled) return

    if (timerRef.current) clearTimeout(timerRef.current)
    setStatus('idle')

    timerRef.current = setTimeout(() => {
      void save()
    }, debounceMs)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [value, enabled, debounceMs, save])

  return { status, lastSavedAt, save }
}
