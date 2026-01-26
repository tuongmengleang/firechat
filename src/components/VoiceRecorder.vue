<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useVoiceRecording } from '@/composables/useVoiceRecording'
import type { VoiceAttachment } from '@/types/chat'

const props = defineProps<{
  roomId?: string
  username: string
}>()

const emit = defineEmits<{
  send: [voice: VoiceAttachment]
  cancel: []
}>()

const {
  recordingState,
  isPaused,
  isProcessing,
  canRecord,
  isMobile,
  startRecording,
  pauseRecording,
  resumeRecording,
  stopRecording,
  cancelRecording,
  uploadVoiceMessage,
  cancelUpload,
  formatDuration,
} = useVoiceRecording(props.roomId)

const showRecorder = ref(false)
const isPressed = ref(false)

// Computed for responsive waveform bars
const waveformBars = computed(() => {
  if (recordingState.value.liveWaveform.length) {
    return recordingState.value.liveWaveform
  }
  // Show fewer bars on mobile for better visibility
  return isMobile ? Array(16).fill(0.1) : Array(20).fill(0.1)
})

const handleMicClick = async (): Promise<void> => {
  if (!showRecorder.value) {
    isPressed.value = true
    const started = await startRecording()
    isPressed.value = false
    if (started) {
      showRecorder.value = true
    }
  }
}

const handlePauseResume = (): void => {
  if (isPaused.value) {
    resumeRecording()
  } else {
    pauseRecording()
  }
}

const handleCancel = (): void => {
  if (isProcessing.value) {
    cancelUpload()
  } else {
    cancelRecording()
  }
  showRecorder.value = false
  emit('cancel')
}

const handleSend = async (): Promise<void> => {
  const audioBlob = await stopRecording()
  if (!audioBlob) {
    showRecorder.value = false
    return
  }

  try {
    const voiceAttachment = await uploadVoiceMessage(audioBlob, props.username)
    if (voiceAttachment) {
      emit('send', voiceAttachment)
    }
  } catch (error) {
    console.error('Failed to send voice message:', error)
  }

  showRecorder.value = false
}

// Prevent zoom on double-tap on mobile
const preventZoom = (e: TouchEvent) => {
  if (e.touches.length > 1) {
    e.preventDefault()
  }
}

onMounted(() => {
  if (isMobile) {
    document.addEventListener('touchstart', preventZoom, { passive: false })
  }
})

onUnmounted(() => {
  if (isMobile) {
    document.removeEventListener('touchstart', preventZoom)
  }
})

const maxBarHeight = 28
</script>

<template>
  <!-- Microphone button (initial state) -->
  <button
    v-if="!showRecorder"
    type="button"
    @click="handleMicClick"
    @touchend.prevent="handleMicClick"
    :disabled="!canRecord || isPressed"
    class="voice-btn flex-shrink-0 rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer touch-manipulation"
    :class="{ 'bg-slate-100 scale-95': isPressed }"
    aria-label="Record voice message"
  >
    <!-- Loading spinner when requesting permission -->
    <svg v-if="isPressed" class="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
      <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
      <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" />
    </svg>
  </button>

  <!-- Recording interface -->
  <div
    v-else
    class="flex items-center gap-2 sm:gap-3 flex-1 bg-slate-50 rounded-2xl px-3 sm:px-4 py-2 border border-slate-200"
  >
    <!-- Cancel button -->
    <button
      type="button"
      @click="handleCancel"
      @touchend.prevent="handleCancel"
      class="voice-btn-sm flex-shrink-0 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 active:bg-red-100 transition-all cursor-pointer touch-manipulation"
      aria-label="Cancel recording"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
        <path fill-rule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
      </svg>
    </button>

    <!-- Live waveform visualizer -->
    <div class="flex-1 flex items-center justify-center gap-[2px] sm:gap-[3px] h-10 min-w-0 overflow-hidden">
      <template v-if="isProcessing">
        <!-- Processing/uploading state -->
        <div class="flex items-center gap-2 text-sm text-slate-500">
          <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span v-if="recordingState.state === 'uploading'" class="whitespace-nowrap">
            {{ recordingState.uploadProgress }}%
          </span>
          <span v-else class="whitespace-nowrap">Processing...</span>
        </div>
      </template>
      <template v-else>
        <!-- Live waveform bars -->
        <div
          v-for="(value, index) in waveformBars"
          :key="index"
          class="waveform-bar bg-indigo-500 rounded-full transition-all duration-75"
          :class="{ 'opacity-50': isPaused, 'animate-pulse-slow': isPaused }"
          :style="{
            width: isMobile ? '4px' : '3px',
            height: `${Math.max(4, value * maxBarHeight)}px`,
          }"
        />
      </template>
    </div>

    <!-- Recording indicator + Duration display -->
    <div class="flex items-center gap-1 flex-shrink-0">
      <!-- Recording dot indicator -->
      <div
        v-if="!isPaused && !isProcessing"
        class="w-2 h-2 rounded-full bg-red-500 animate-pulse"
      />
      <div class="text-sm font-mono text-slate-600 min-w-[40px] sm:min-w-[45px] text-right tabular-nums">
        {{ formatDuration(recordingState.duration) }}
      </div>
    </div>

    <!-- Pause/Resume button -->
    <button
      v-if="!isProcessing"
      type="button"
      @click="handlePauseResume"
      @touchend.prevent="handlePauseResume"
      class="voice-btn-sm flex-shrink-0 rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-200 active:bg-slate-300 transition-all cursor-pointer touch-manipulation"
      :class="{ 'bg-slate-200': isPaused }"
      :aria-label="isPaused ? 'Resume recording' : 'Pause recording'"
    >
      <!-- Pause icon -->
      <svg v-if="!isPaused" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
        <path fill-rule="evenodd" d="M6.75 5.25a.75.75 0 0 1 .75-.75H9a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H7.5a.75.75 0 0 1-.75-.75V5.25Zm7.5 0A.75.75 0 0 1 15 4.5h1.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H15a.75.75 0 0 1-.75-.75V5.25Z" clip-rule="evenodd" />
      </svg>
      <!-- Play/Resume icon -->
      <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
        <path fill-rule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clip-rule="evenodd" />
      </svg>
    </button>

    <!-- Send button -->
    <button
      type="button"
      @click="handleSend"
      @touchend.prevent="handleSend"
      :disabled="isProcessing || recordingState.duration < 0.5"
      class="voice-btn-sm flex-shrink-0 rounded-full bg-indigo-600 text-white shadow-md transition-all hover:bg-indigo-700 active:bg-indigo-800 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer touch-manipulation"
      aria-label="Send voice message"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
        <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
      </svg>
    </button>
  </div>

  <!-- Error display -->
  <div
    v-if="recordingState.error && !showRecorder"
    class="absolute bottom-full left-0 right-0 mb-2 px-4"
  >
    <div class="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2 border border-red-200 flex items-start gap-2">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5 flex-shrink-0 mt-0.5">
        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
      </svg>
      <span>{{ recordingState.error }}</span>
    </div>
  </div>
</template>

<style scoped>
/* Minimum touch target sizes for mobile (44x44px) */
.voice-btn {
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem;
  -webkit-tap-highlight-color: transparent;
}

.voice-btn-sm {
  min-width: 40px;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  -webkit-tap-highlight-color: transparent;
}

@media (min-width: 640px) {
  .voice-btn-sm {
    min-width: 36px;
    min-height: 36px;
  }
}

/* Prevent text selection on touch */
.touch-manipulation {
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
}

.waveform-bar {
  will-change: height;
}

/* Subtle animation for active recording */
@keyframes pulse-slow {
  0%, 100% {
    opacity: 0.5;
  }
  50% {
    opacity: 0.8;
  }
}

.animate-pulse-slow {
  animation: pulse-slow 2s ease-in-out infinite;
}

/* Tabular nums for consistent width */
.tabular-nums {
  font-variant-numeric: tabular-nums;
}
</style>
