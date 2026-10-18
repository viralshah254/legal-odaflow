/**
 * Captures microphone audio as 16 kHz mono linear16 PCM frames for Deepgram streaming.
 *
 * Uses AudioWorklet when available (modern), falls back to ScriptProcessorNode (legacy).
 * Frames are emitted at ~250ms intervals (~4000 samples at 16 kHz).
 */

const TARGET_SAMPLE_RATE = 16000
const FRAME_SIZE = 4000 // samples per frame @ 16 kHz → ~250ms

type PcmFrameCallback = (pcm: ArrayBuffer) => void
type CleanupFn = () => void

/**
 * Downsamples a Float32Array from `sourceRate` to `TARGET_SAMPLE_RATE`
 * using linear interpolation, then converts to Int16 (linear16).
 */
function downsampleToLinear16(samples: Float32Array, sourceRate: number): ArrayBuffer {
  const ratio = sourceRate / TARGET_SAMPLE_RATE
  const outLength = Math.floor(samples.length / ratio)
  const out = new Int16Array(outLength)
  for (let i = 0; i < outLength; i++) {
    const srcIdx = i * ratio
    const lo = Math.floor(srcIdx)
    const hi = Math.min(lo + 1, samples.length - 1)
    const t = srcIdx - lo
    const sample = samples[lo] * (1 - t) + samples[hi] * t
    out[i] = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)))
  }
  return out.buffer
}

/**
 * Start capturing 16 kHz mono linear16 PCM from `stream`.
 * Calls `onFrame` each time a ~250ms batch of audio is ready.
 * Returns a cleanup function — call it to stop capture.
 */
export function startPcmCapture(
  stream: MediaStream,
  onFrame: PcmFrameCallback,
): CleanupFn {
  let audioCtx: AudioContext | null = null
  let source: MediaStreamAudioSourceNode | null = null
  let processorNode: ScriptProcessorNode | null = null
  let stopped = false

  // Accumulate PCM samples between callbacks
  let accumulator: Int16Array = new Int16Array(0)

  const flush = (frame: Int16Array) => {
    if (stopped || frame.length === 0) return
    // Always create a plain ArrayBuffer copy (not a SharedArrayBuffer view)
    const buf = new ArrayBuffer(frame.byteLength)
    new Int16Array(buf).set(frame)
    onFrame(buf)
  }

  const setup = () => {
    try {
      audioCtx = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE })
    } catch {
      // Browser may not support specifying sampleRate; use default and resample
      audioCtx = new AudioContext()
    }

    source = audioCtx.createMediaStreamSource(stream)

    // ScriptProcessor is deprecated but universally supported and doesn't need a separate file
    const bufferSize = 4096
    processorNode = audioCtx.createScriptProcessor(bufferSize, 1, 1)

    processorNode.onaudioprocess = (e) => {
      if (stopped) return
      const inputData = e.inputBuffer.getChannelData(0)
      const rawBuffer = downsampleToLinear16(inputData, audioCtx!.sampleRate)
      const pcmChunk = new Int16Array(rawBuffer)

      // Merge into accumulator
      const merged = new Int16Array(accumulator.length + pcmChunk.length)
      merged.set(accumulator)
      merged.set(pcmChunk, accumulator.length)
      accumulator = merged

      // Emit in FRAME_SIZE chunks
      while (accumulator.length >= FRAME_SIZE) {
        const frame = accumulator.slice(0, FRAME_SIZE)
        accumulator = accumulator.slice(FRAME_SIZE)
        flush(frame)
      }
    }

    source.connect(processorNode)
    processorNode.connect(audioCtx.destination)
  }

  setup()

  return () => {
    stopped = true
    if (processorNode) {
      processorNode.onaudioprocess = null
      try { processorNode.disconnect() } catch {}
    }
    if (source) {
      try { source.disconnect() } catch {}
    }
    if (audioCtx) {
      audioCtx.close().catch(() => {})
    }
    accumulator = new Int16Array(0)
  }
}
