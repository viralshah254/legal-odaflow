export function isMediaCaptureSupported(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia)
}

export async function getMeetingMediaStream(includeVideo: boolean): Promise<MediaStream> {
  if (!isMediaCaptureSupported()) {
    throw new DOMException(
      "Recording is not supported in this browser.",
      "NotSupportedError",
    )
  }

  const videoConstraints: MediaTrackConstraints | boolean = includeVideo
    ? { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }
    : false

  const attempts: MediaStreamConstraints[] = [
    {
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: videoConstraints,
    },
    { audio: true, video: videoConstraints },
  ]

  let lastError: unknown
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints)
    } catch (error) {
      lastError = error
      // Permission denied — don't retry with looser constraints.
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        throw error
      }
    }
  }

  throw lastError ?? new DOMException("Could not access microphone.", "NotFoundError")
}

export function pickRecorderMimeType(includeVideo: boolean): string | undefined {
  const candidates = recorderMimeTypeCandidates(includeVideo)
  return candidates.find((type) => MediaRecorder.isTypeSupported(type))
}

export function recorderMimeTypeCandidates(includeVideo: boolean): string[] {
  return includeVideo
    ? ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"]
    : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"]
}

export function createMeetingMediaRecorder(
  stream: MediaStream,
  includeVideo: boolean,
): MediaRecorder {
  if (typeof MediaRecorder === "undefined") {
    throw new DOMException("Recording is not supported in this browser.", "NotSupportedError")
  }

  const candidates = recorderMimeTypeCandidates(includeVideo)
  let lastError: unknown

  for (const mimeType of candidates) {
    if (!MediaRecorder.isTypeSupported(mimeType)) continue
    try {
      return new MediaRecorder(stream, { mimeType })
    } catch (error) {
      lastError = error
    }
  }

  try {
    return new MediaRecorder(stream)
  } catch (error) {
    throw lastError ?? error
  }
}

export function mediaCaptureErrorMessage(includeVideo: boolean, error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return includeVideo
        ? "Microphone or camera blocked. In Brave: click the lion icon → Advanced controls → allow microphone. Also check System Settings → Privacy → Microphone."
        : "Microphone blocked. In Brave: click the lion icon → turn off Shields for localhost → allow microphone when prompted. Also check System Settings → Privacy → Microphone."
    }
    if (error.name === "NotFoundError") {
      return includeVideo
        ? "No microphone or camera detected. Connect a device, then in Brave turn off Shields for this site and retry."
        : "No microphone detected. Connect a mic (or enable it in System Settings → Privacy → Microphone for Brave), turn off Brave Shields for localhost, then click Allow microphone again."
    }
    if (error.name === "NotSupportedError") {
      return "Recording is not supported in this browser. Try Chrome or disable Brave Shields for localhost."
    }
    if (error.name === "InvalidStateError") {
      return "Microphone session ended. Click Allow mic to start again."
    }
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return includeVideo
    ? "Could not access microphone or camera. Check browser permissions and try again."
    : "Could not access microphone. Check browser permissions and try again."
}

export function stopMediaStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((track) => track.stop())
}

export function isLiveMediaStream(stream: MediaStream | null | undefined): boolean {
  if (!stream) return false
  return stream.getAudioTracks().some((track) => track.readyState === "live")
}
