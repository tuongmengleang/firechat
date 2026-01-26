import { ref, computed, onUnmounted, onMounted } from 'vue'
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  type UploadTask,
} from 'firebase/storage'
import { storage } from '@/config/firebase'
import type { VoiceAttachment } from '@/types/chat'
import { MAX_VOICE_DURATION, WAVEFORM_SAMPLES } from '@/types/chat'
import RecordRTC, { StereoAudioRecorder } from 'recordrtc'

export type RecordingState = 'idle' | 'requesting' | 'recording' | 'paused' | 'processing' | 'uploading'
export type PermissionState = 'prompt' | 'granted' | 'denied' | 'unsupported'

export interface VoiceRecordingState {
  state: RecordingState
  permission: PermissionState
  duration: number
  error: string | null
  uploadProgress: number
  liveWaveform: number[]
}

// Detect mobile browser
const isMobile = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

// Detect iOS Safari specifically
const isIOSSafari = (): boolean => {
  const ua = navigator.userAgent
  const iOS = /iPad|iPhone|iPod/.test(ua)
  const webkit = /WebKit/.test(ua)
  const notChrome = !/CriOS/.test(ua)
  return iOS && webkit && notChrome
}

export function useVoiceRecording(roomId: string = 'general') {
  const recordingState = ref<VoiceRecordingState>({
    state: 'idle',
    permission: 'prompt',
    duration: 0,
    error: null,
    uploadProgress: 0,
    liveWaveform: [],
  })

  let recorder: RecordRTC | null = null
  let audioContext: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let mediaStream: MediaStream | null = null
  let durationInterval: ReturnType<typeof setInterval> | null = null
  let animationFrameId: number | null = null
  let currentUploadTask: UploadTask | null = null
  let recordingStartTime: number = 0
  let pausedDuration: number = 0
  let visibilityHandler: (() => void) | null = null

  // Resume AudioContext on iOS Safari (required after user gesture)
  const resumeAudioContext = async (ctx: AudioContext): Promise<void> => {
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume()
      } catch (e) {
        console.warn('Failed to resume AudioContext:', e)
      }
    }
  }

  const isRecording = computed(() => recordingState.value.state === 'recording')
  const isPaused = computed(() => recordingState.value.state === 'paused')
  const isProcessing = computed(() =>
    recordingState.value.state === 'processing' ||
    recordingState.value.state === 'uploading'
  )
  const canRecord = computed(() =>
    recordingState.value.permission === 'granted' ||
    recordingState.value.permission === 'prompt'
  )

  const checkBrowserSupport = (): boolean => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      recordingState.value.permission = 'unsupported'
      recordingState.value.error = 'Your browser does not support audio recording'
      return false
    }
    return true
  }

  const updateLiveWaveform = (): void => {
    if (!analyser || recordingState.value.state !== 'recording') return

    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteFrequencyData(dataArray)

    // Sample the frequency data to create waveform bars
    const samples: number[] = []
    const step = Math.floor(dataArray.length / 20)
    for (let i = 0; i < 20; i++) {
      const start = i * step
      const end = start + step
      let sum = 0
      for (let j = start; j < end; j++) {
        const value = dataArray[j]
        if (value !== undefined) {
          sum += value
        }
      }
      // Normalize to 0-1 range
      samples.push(sum / (step * 255))
    }

    recordingState.value.liveWaveform = samples
    animationFrameId = requestAnimationFrame(updateLiveWaveform)
  }

  const requestPermission = async (): Promise<boolean> => {
    if (!checkBrowserSupport()) return false

    recordingState.value.state = 'requesting'
    recordingState.value.error = null

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Stop the stream immediately, we just needed to check permission
      stream.getTracks().forEach(track => track.stop())
      recordingState.value.permission = 'granted'
      recordingState.value.state = 'idle'
      return true
    } catch (error) {
      const err = error as Error
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        recordingState.value.permission = 'denied'
        recordingState.value.error = 'Microphone permission denied. Please allow access in your browser settings.'
      } else if (err.name === 'NotFoundError') {
        recordingState.value.permission = 'unsupported'
        recordingState.value.error = 'No microphone found. Please connect a microphone and try again.'
      } else {
        recordingState.value.error = 'Failed to access microphone: ' + err.message
      }
      recordingState.value.state = 'idle'
      return false
    }
  }

  const startRecording = async (): Promise<boolean> => {
    if (!checkBrowserSupport()) return false

    recordingState.value.error = null
    recordingState.value.state = 'requesting'

    try {
      // Request microphone with mobile-optimized constraints
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Lower sample rate for better mobile compatibility
          sampleRate: isIOSSafari() ? 44100 : 44100,
        }
      }

      mediaStream = await navigator.mediaDevices.getUserMedia(constraints)

      recordingState.value.permission = 'granted'

      // Set up audio context and analyser for visualization
      // Use webkitAudioContext for older iOS Safari versions
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      audioContext = new AudioContextClass()

      // iOS Safari requires resuming AudioContext after user gesture
      await resumeAudioContext(audioContext)

      analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      const source = audioContext.createMediaStreamSource(mediaStream)
      source.connect(analyser)

      // Set up RecordRTC with better cross-browser support
      recorder = new RecordRTC(mediaStream, {
        type: 'audio',
        mimeType: 'audio/wav',
        recorderType: StereoAudioRecorder,
        numberOfAudioChannels: 1,
        desiredSampRate: 44100,
        disableLogs: true,
      })

      recorder.startRecording()
      recordingState.value.state = 'recording'
      recordingState.value.duration = 0
      recordingState.value.liveWaveform = []
      recordingStartTime = Date.now()
      pausedDuration = 0

      // Start duration timer
      durationInterval = setInterval(() => {
        recordingState.value.duration += 0.1
        if (recordingState.value.duration >= MAX_VOICE_DURATION) {
          stopRecording()
        }
      }, 100)

      // Start live waveform updates
      updateLiveWaveform()

      // Handle page visibility changes on mobile (e.g., switching apps)
      visibilityHandler = () => {
        if (document.hidden && recordingState.value.state === 'recording') {
          // Auto-pause when app goes to background
          pauseRecording()
        }
      }
      document.addEventListener('visibilitychange', visibilityHandler)

      // Trigger haptic feedback on mobile if available
      if (isMobile() && navigator.vibrate) {
        navigator.vibrate(50)
      }

      return true
    } catch (error) {
      const err = error as Error
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        recordingState.value.permission = 'denied'
        recordingState.value.error = isMobile()
          ? 'Microphone access denied. Please enable it in your device settings.'
          : 'Microphone permission denied. Please allow access in your browser settings.'
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        recordingState.value.permission = 'unsupported'
        recordingState.value.error = 'No microphone found on this device.'
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        recordingState.value.error = 'Microphone is in use by another app. Please close other apps and try again.'
      } else if (err.name === 'OverconstrainedError') {
        recordingState.value.error = 'Could not access microphone with required settings.'
      } else {
        recordingState.value.error = 'Failed to start recording. Please try again.'
      }
      recordingState.value.state = 'idle'
      cleanup()
      return false
    }
  }

  const pauseRecording = (): void => {
    if (recorder && recordingState.value.state === 'recording') {
      recorder.pauseRecording()
      recordingState.value.state = 'paused'
      if (durationInterval) {
        clearInterval(durationInterval)
        durationInterval = null
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
        animationFrameId = null
      }
    }
  }

  const resumeRecording = (): void => {
    if (recorder && recordingState.value.state === 'paused') {
      recorder.resumeRecording()
      recordingState.value.state = 'recording'

      durationInterval = setInterval(() => {
        recordingState.value.duration += 0.1
        if (recordingState.value.duration >= MAX_VOICE_DURATION) {
          stopRecording()
        }
      }, 100)

      updateLiveWaveform()
    }
  }

  const stopRecording = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!recorder || (recordingState.value.state !== 'recording' && recordingState.value.state !== 'paused')) {
        resolve(null)
        return
      }

      recordingState.value.state = 'processing'

      recorder.stopRecording(() => {
        const blob = recorder?.getBlob()
        cleanup()
        resolve(blob || null)
      })
    })
  }

  const cancelRecording = (): void => {
    if (recorder) {
      recorder.stopRecording(() => {
        cleanup()
      })
    } else {
      cleanup()
    }
    recordingState.value.state = 'idle'
    recordingState.value.duration = 0
    recordingState.value.liveWaveform = []
  }

  const generateWaveform = async (audioBlob: Blob): Promise<number[]> => {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer()
      // Use webkitAudioContext for older iOS Safari versions
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const audioCtx = new AudioContextClass()

      // Resume context if needed (iOS Safari)
      await resumeAudioContext(audioCtx)

      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)

      const rawData = audioBuffer.getChannelData(0)
      const samples: number[] = []
      const blockSize = Math.floor(rawData.length / WAVEFORM_SAMPLES)

      for (let i = 0; i < WAVEFORM_SAMPLES; i++) {
        const start = blockSize * i
        let sum = 0
        for (let j = 0; j < blockSize; j++) {
          const value = rawData[start + j]
          if (value !== undefined) {
            sum += Math.abs(value)
          }
        }
        samples.push(sum / blockSize)
      }

      // Normalize the samples
      const max = Math.max(...samples)
      const normalizedSamples = max > 0
        ? samples.map(s => s / max)
        : samples.map(() => 0.1)

      audioCtx.close()
      return normalizedSamples
    } catch (error) {
      console.error('Failed to generate waveform:', error)
      // Return default waveform on error
      return Array(WAVEFORM_SAMPLES).fill(0.3)
    }
  }

  const getAudioDuration = async (audioBlob: Blob): Promise<number> => {
    return new Promise((resolve) => {
      const audio = new Audio()
      const objectUrl = URL.createObjectURL(audioBlob)
      audio.src = objectUrl

      // Timeout to prevent indefinite waiting
      const timeout = setTimeout(() => {
        URL.revokeObjectURL(objectUrl)
        // Fall back to recorded duration
        resolve(recordingState.value.duration)
      }, 5000)

      audio.onloadedmetadata = () => {
        clearTimeout(timeout)
        URL.revokeObjectURL(objectUrl)
        const duration = audio.duration
        // Validate the duration is a finite positive number
        if (Number.isFinite(duration) && duration > 0) {
          resolve(duration)
        } else {
          // Fall back to recorded duration
          resolve(recordingState.value.duration)
        }
      }

      audio.onerror = () => {
        clearTimeout(timeout)
        URL.revokeObjectURL(objectUrl)
        resolve(recordingState.value.duration)
      }
    })
  }

  const uploadVoiceMessage = async (
    audioBlob: Blob,
    username: string
  ): Promise<VoiceAttachment | null> => {
    recordingState.value.state = 'uploading'
    recordingState.value.uploadProgress = 0
    recordingState.value.error = null

    // Store the recorded duration before it gets reset
    const recordedDuration = recordingState.value.duration

    try {
      // Generate waveform and get duration in parallel
      const [waveform, audioDuration] = await Promise.all([
        generateWaveform(audioBlob),
        getAudioDuration(audioBlob),
      ])

      // Use audio duration if valid, otherwise use recorded duration
      const duration = Number.isFinite(audioDuration) && audioDuration > 0
        ? audioDuration
        : recordedDuration

      const timestamp = Date.now()
      // RecordRTC with StereoAudioRecorder outputs WAV
      const extension = 'wav'
      const filePath = `chatRooms/${roomId}/${username}/voice_${timestamp}.${extension}`
      const fileRef = storageRef(storage, filePath)

      return new Promise((resolve, reject) => {
        currentUploadTask = uploadBytesResumable(fileRef, audioBlob)

        currentUploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
            recordingState.value.uploadProgress = Math.round(progress)
          },
          (error) => {
            currentUploadTask = null
            recordingState.value.state = 'idle'

            if (error.code === 'storage/canceled') {
              recordingState.value.error = 'Upload canceled'
              resolve(null)
            } else {
              recordingState.value.error = 'Upload failed. Please try again.'
              reject(error)
            }
          },
          async () => {
            try {
              const downloadUrl = await getDownloadURL(currentUploadTask!.snapshot.ref)
              currentUploadTask = null

              const voiceAttachment: VoiceAttachment = {
                url: downloadUrl,
                duration,
                waveform,
                mimeType: 'audio/wav',
                size: audioBlob.size,
              }

              recordingState.value.state = 'idle'
              recordingState.value.uploadProgress = 0
              recordingState.value.duration = 0

              resolve(voiceAttachment)
            } catch (error) {
              recordingState.value.state = 'idle'
              recordingState.value.error = 'Failed to get download URL'
              reject(error)
            }
          }
        )
      })
    } catch (error) {
      recordingState.value.state = 'idle'
      recordingState.value.error = 'Failed to process voice message'
      throw error
    }
  }

  const cancelUpload = (): void => {
    if (currentUploadTask) {
      currentUploadTask.cancel()
      currentUploadTask = null
    }
    recordingState.value.state = 'idle'
    recordingState.value.uploadProgress = 0
  }

  const cleanup = (): void => {
    if (durationInterval) {
      clearInterval(durationInterval)
      durationInterval = null
    }
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
    if (visibilityHandler) {
      document.removeEventListener('visibilitychange', visibilityHandler)
      visibilityHandler = null
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop())
      mediaStream = null
    }
    if (audioContext) {
      audioContext.close()
      audioContext = null
    }
    if (recorder) {
      recorder.destroy()
      recorder = null
    }
    analyser = null
  }

  const formatDuration = (seconds: number): string => {
    // Handle invalid values
    if (!Number.isFinite(seconds) || seconds < 0) {
      return '0:00'
    }
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  onUnmounted(() => {
    cleanup()
    cancelUpload()
  })

  return {
    recordingState,
    isRecording,
    isPaused,
    isProcessing,
    canRecord,
    isMobile: isMobile(),
    requestPermission,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
    uploadVoiceMessage,
    cancelUpload,
    formatDuration,
  }
}
