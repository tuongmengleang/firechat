<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { VoiceAttachment } from '@/types/chat'
import { usePresignedUrl } from '@/composables/usePresignedUrl'

const props = defineProps<{
  voice: VoiceAttachment
  isOwn?: boolean
}>()

const { resolvedUrl, isLoading: urlLoading, error: urlError } = usePresignedUrl(() => props.voice.url)

const audioRef = ref<HTMLAudioElement | null>(null)
const waveformRef = ref<HTMLDivElement | null>(null)

const isPlaying = ref(false)
const isAudioLoading = ref(true)
const currentTime = ref(0)
const duration = ref(props.voice.duration || 0)
const playbackSpeed = ref<1 | 1.5 | 2>(1)
const error = ref<string | null>(null)

// Combined loading state
const isLoading = computed(() => urlLoading.value || isAudioLoading.value)

// Watch for URL errors
watch(urlError, (err) => {
  if (err) {
    error.value = 'Failed to load audio'
    isAudioLoading.value = false
  }
})

const progress = computed(() => {
  if (duration.value === 0) return 0
  return (currentTime.value / duration.value) * 100
})

const formatTime = (seconds: number): string => {
  // Handle invalid values (Infinity, NaN, negative)
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00'
  }
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const togglePlayPause = (): void => {
  if (!audioRef.value) return

  if (isPlaying.value) {
    audioRef.value.pause()
  } else {
    audioRef.value.play().catch(err => {
      console.error('Failed to play audio:', err)
      error.value = 'Failed to play audio'
    })
  }
}

const cycleSpeed = (): void => {
  const speeds: (1 | 1.5 | 2)[] = [1, 1.5, 2]
  const currentIndex = speeds.indexOf(playbackSpeed.value)
  const nextSpeed = speeds[(currentIndex + 1) % speeds.length]
  if (nextSpeed !== undefined) {
    playbackSpeed.value = nextSpeed
  }

  if (audioRef.value) {
    audioRef.value.playbackRate = playbackSpeed.value
  }
}

const handleWaveformClick = (event: MouseEvent | TouchEvent): void => {
  if (!audioRef.value || !waveformRef.value) return

  const rect = waveformRef.value.getBoundingClientRect()
  let clientX: number

  if ('touches' in event && event.touches.length > 0) {
    clientX = event.touches[0]!.clientX
  } else if ('clientX' in event) {
    clientX = event.clientX
  } else {
    return
  }

  const clickX = clientX - rect.left
  const percentage = Math.max(0, Math.min(1, clickX / rect.width))
  const seekTime = percentage * duration.value

  audioRef.value.currentTime = seekTime
  currentTime.value = seekTime
}

const handleWaveformKeydown = (event: KeyboardEvent): void => {
  if (!audioRef.value) return

  const step = 5 // seconds
  if (event.key === 'ArrowLeft') {
    audioRef.value.currentTime = Math.max(0, audioRef.value.currentTime - step)
  } else if (event.key === 'ArrowRight') {
    audioRef.value.currentTime = Math.min(duration.value, audioRef.value.currentTime + step)
  } else if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault()
    togglePlayPause()
  }
}

const onLoadedMetadata = (): void => {
  if (audioRef.value) {
    const audioDuration = audioRef.value.duration
    // Only use audio element duration if it's a valid finite number
    if (Number.isFinite(audioDuration) && audioDuration > 0) {
      duration.value = audioDuration
    } else {
      // Fallback to props duration or 0
      duration.value = props.voice.duration || 0
    }
    isAudioLoading.value = false
  }
}

// Handle duration updates (some browsers report duration late)
const onDurationChange = (): void => {
  if (audioRef.value) {
    const audioDuration = audioRef.value.duration
    if (Number.isFinite(audioDuration) && audioDuration > 0) {
      duration.value = audioDuration
    }
  }
}

const onTimeUpdate = (): void => {
  if (audioRef.value) {
    currentTime.value = audioRef.value.currentTime
  }
}

const onPlay = (): void => {
  isPlaying.value = true
}

const onPause = (): void => {
  isPlaying.value = false
}

const onEnded = (): void => {
  isPlaying.value = false
  currentTime.value = 0
  if (audioRef.value) {
    audioRef.value.currentTime = 0
  }
}

const onError = (): void => {
  isAudioLoading.value = false
  error.value = 'Failed to load audio'
}

const onCanPlay = (): void => {
  isAudioLoading.value = false
}

// Calculate which bars should be highlighted based on progress
const getBarOpacity = (index: number, total: number): number => {
  const barProgress = ((index + 1) / total) * 100
  if (barProgress <= progress.value) {
    return 1
  }
  return 0.3
}

const waveformBars = computed(() => {
  const bars = props.voice.waveform.length > 0
    ? props.voice.waveform
    : Array(50).fill(0.3)
  return bars
})
</script>

<template>
  <div
    class="voice-message rounded-2xl p-3 max-w-[280px] sm:max-w-[320px]"
    :class="isOwn ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200'"
  >
    <!-- Hidden audio element -->
    <audio
      v-if="resolvedUrl"
      ref="audioRef"
      :src="resolvedUrl"
      preload="metadata"
      @loadedmetadata="onLoadedMetadata"
      @durationchange="onDurationChange"
      @timeupdate="onTimeUpdate"
      @play="onPlay"
      @pause="onPause"
      @ended="onEnded"
      @error="onError"
      @canplay="onCanPlay"
    />

    <!-- Error state -->
    <div v-if="error" class="flex items-center gap-2 text-sm" :class="isOwn ? 'text-indigo-200' : 'text-red-500'">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
        <path fill-rule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clip-rule="evenodd" />
      </svg>
      <span>{{ error }}</span>
    </div>

    <!-- Player UI -->
    <div v-else class="flex items-center gap-2 sm:gap-3">
      <!-- Play/Pause button -->
      <button
        type="button"
        @click="togglePlayPause"
        @touchend.prevent="togglePlayPause"
        :disabled="isLoading"
        class="play-btn flex-shrink-0 rounded-full transition-all cursor-pointer touch-manipulation"
        :class="isOwn
          ? 'bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-400 text-white'
          : 'bg-slate-100 hover:bg-slate-200 active:bg-slate-200 text-slate-700'"
        aria-label="Play or pause voice message"
      >
        <!-- Loading spinner -->
        <svg v-if="isLoading" class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <!-- Pause icon -->
        <svg v-else-if="isPlaying" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
          <path fill-rule="evenodd" d="M6.75 5.25a.75.75 0 0 1 .75-.75H9a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H7.5a.75.75 0 0 1-.75-.75V5.25Zm7.5 0A.75.75 0 0 1 15 4.5h1.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H15a.75.75 0 0 1-.75-.75V5.25Z" clip-rule="evenodd" />
        </svg>
        <!-- Play icon -->
        <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
          <path fill-rule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clip-rule="evenodd" />
        </svg>
      </button>

      <!-- Waveform progress bar -->
      <div class="flex-1 flex flex-col gap-1 min-w-0">
        <div
          ref="waveformRef"
          class="flex items-center gap-[2px] h-10 sm:h-8 cursor-pointer touch-manipulation py-1"
          role="slider"
          tabindex="0"
          :aria-valuenow="Math.round(progress)"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label="Audio progress"
          @click="handleWaveformClick"
          @touchstart.prevent="handleWaveformClick"
          @keydown="handleWaveformKeydown"
        >
          <div
            v-for="(value, index) in waveformBars"
            :key="index"
            class="waveform-bar rounded-full transition-opacity duration-150"
            :class="isOwn ? 'bg-white' : 'bg-indigo-500'"
            :style="{
              width: '2px',
              height: `${Math.max(4, value * 28)}px`,
              opacity: getBarOpacity(index, waveformBars.length),
            }"
          />
        </div>

        <!-- Time and speed controls -->
        <div class="flex items-center justify-between text-xs">
          <span :class="isOwn ? 'text-indigo-200' : 'text-slate-500'" class="font-mono tabular-nums">
            {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
          </span>
          <button
            type="button"
            @click="cycleSpeed"
            @touchend.prevent="cycleSpeed"
            class="speed-btn rounded font-medium transition-all cursor-pointer touch-manipulation"
            :class="isOwn
              ? 'bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-400 text-white'
              : 'bg-slate-100 hover:bg-slate-200 active:bg-slate-200 text-slate-600'"
            aria-label="Change playback speed"
          >
            {{ playbackSpeed }}x
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.voice-message {
  transition: transform 0.1s ease;
}

.voice-message:hover {
  transform: scale(1.01);
}

.waveform-bar {
  flex-shrink: 0;
}

/* Minimum touch target sizes for mobile (44x44px) */
.play-btn {
  min-width: 40px;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  -webkit-tap-highlight-color: transparent;
}

.speed-btn {
  min-width: 36px;
  min-height: 28px;
  padding: 0.25rem 0.5rem;
  -webkit-tap-highlight-color: transparent;
}

/* Prevent text selection on touch */
.touch-manipulation {
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
}

/* Tabular nums for consistent width */
.tabular-nums {
  font-variant-numeric: tabular-nums;
}
</style>
