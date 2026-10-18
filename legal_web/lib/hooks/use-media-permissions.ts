"use client"

import { useState, useEffect, useCallback } from "react"

export type PermissionState = "granted" | "denied" | "prompt" | "unsupported"

interface MediaPermissions {
  micState: PermissionState
  cameraState: PermissionState
  requestMic: () => Promise<void>
  requestCamera: () => Promise<void>
}

async function queryPermission(name: PermissionName): Promise<PermissionState> {
  if (typeof navigator === "undefined" || !navigator.permissions) return "unsupported"
  try {
    const status = await navigator.permissions.query({ name })
    return status.state as PermissionState
  } catch {
    // Some browsers (Firefox) don't support querying camera/microphone
    return "unsupported"
  }
}

async function requestStream(constraints: MediaStreamConstraints): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return
  let stream: MediaStream | null = null
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints)
  } finally {
    stream?.getTracks().forEach((t) => t.stop())
  }
}

export function useMediaPermissions(): MediaPermissions {
  const [micState, setMicState] = useState<PermissionState>("unsupported")
  const [cameraState, setCameraState] = useState<PermissionState>("unsupported")

  useEffect(() => {
    let micStatus: PermissionStatus | null = null
    let cameraStatus: PermissionStatus | null = null

    const setup = async () => {
      // Mic
      if (navigator.permissions) {
        try {
          micStatus = await navigator.permissions.query({ name: "microphone" as PermissionName })
          setMicState(micStatus.state as PermissionState)
          micStatus.onchange = () => setMicState(micStatus!.state as PermissionState)
        } catch {
          setMicState("unsupported")
        }

        // Camera
        try {
          cameraStatus = await navigator.permissions.query({ name: "camera" as PermissionName })
          setCameraState(cameraStatus.state as PermissionState)
          cameraStatus.onchange = () => setCameraState(cameraStatus!.state as PermissionState)
        } catch {
          setCameraState("unsupported")
        }
      }
    }

    if (typeof navigator !== "undefined") setup()

    return () => {
      if (micStatus) micStatus.onchange = null
      if (cameraStatus) cameraStatus.onchange = null
    }
  }, [])

  const requestMic = useCallback(async () => {
    try {
      await requestStream({ audio: true, video: false })
      setMicState("granted")
    } catch (e) {
      if (e instanceof DOMException && e.name === "NotAllowedError") {
        setMicState("denied")
      }
    }
  }, [])

  const requestCamera = useCallback(async () => {
    try {
      await requestStream({ audio: false, video: true })
      setCameraState("granted")
    } catch (e) {
      if (e instanceof DOMException && e.name === "NotAllowedError") {
        setCameraState("denied")
      }
    }
  }, [])

  return { micState, cameraState, requestMic, requestCamera }
}
