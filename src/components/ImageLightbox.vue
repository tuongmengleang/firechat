<script setup lang="ts">
import type { FileAttachment } from '@/types/chat'
import { usePresignedUrl } from '@/composables/usePresignedUrl'

const props = defineProps<{
  files: FileAttachment[]
  initialIndex: number
}>()

const emit = defineEmits<{
  close: []
}>()

const currentIndex = ref(props.initialIndex)
const isLoading = ref(true)
const hasError = ref(false)
const touchStartX = ref(0)
const touchEndX = ref(0)

const currentFile = computed(() => props.files[currentIndex.value])

const { resolvedUrl, isLoading: urlLoading, error: urlError } = usePresignedUrl(
  () => currentFile.value?.url ?? ''
)

watch(urlError, (err) => {
  if (err) hasError.value = true
})

watch(currentIndex, () => {
  isLoading.value = true
  hasError.value = false
})

const canGoPrev = computed(() => currentIndex.value > 0)
const canGoNext = computed(() => currentIndex.value < props.files.length - 1)

const goToPrev = (): void => {
  if (canGoPrev.value) {
    currentIndex.value--
  }
}

const goToNext = (): void => {
  if (canGoNext.value) {
    currentIndex.value++
  }
}

const handleLoad = (): void => {
  isLoading.value = false
}

const handleError = (): void => {
  isLoading.value = false
  hasError.value = true
}

const handleKeydown = (e: KeyboardEvent): void => {
  switch (e.key) {
    case 'Escape':
      emit('close')
      break
    case 'ArrowLeft':
      goToPrev()
      break
    case 'ArrowRight':
      goToNext()
      break
  }
}

const handleTouchStart = (e: TouchEvent): void => {
  const touch = e.changedTouches[0]
  if (touch) {
    touchStartX.value = touch.screenX
  }
}

const handleTouchEnd = (e: TouchEvent): void => {
  const touch = e.changedTouches[0]
  if (touch) {
    touchEndX.value = touch.screenX
    handleSwipe()
  }
}

const handleSwipe = (): void => {
  const diff = touchStartX.value - touchEndX.value
  const threshold = 50

  if (Math.abs(diff) < threshold) return

  if (diff > 0) {
    goToNext()
  } else {
    goToPrev()
  }
}

const handleBackdropClick = (e: MouseEvent): void => {
  if (e.target === e.currentTarget) {
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  document.body.style.overflow = 'hidden'
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="lightbox">
      <div
        class="fixed inset-0 z-50 bg-black/95 flex flex-col"
        @click="handleBackdropClick"
        @touchstart="handleTouchStart"
        @touchend="handleTouchEnd"
      >
        <!-- Header -->
        <div class="flex-shrink-0 flex items-center justify-between p-4">
          <span class="text-white/70 text-sm">
            {{ currentIndex + 1 }} / {{ files.length }}
          </span>
          <button
            type="button"
            @click="emit('close')"
            class="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
              <path fill-rule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>

        <!-- Image container -->
        <div class="flex-1 relative flex items-center justify-center p-4 min-h-0">
          <!-- Navigation buttons -->
          <button
            v-if="files.length > 1"
            type="button"
            @click.stop="goToPrev"
            :disabled="!canGoPrev"
            class="absolute left-2 sm:left-4 z-10 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            aria-label="Previous image"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
              <path fill-rule="evenodd" d="M7.72 12.53a.75.75 0 0 1 0-1.06l7.5-7.5a.75.75 0 1 1 1.06 1.06L9.31 12l6.97 6.97a.75.75 0 1 1-1.06 1.06l-7.5-7.5Z" clip-rule="evenodd" />
            </svg>
          </button>

          <button
            v-if="files.length > 1"
            type="button"
            @click.stop="goToNext"
            :disabled="!canGoNext"
            class="absolute right-2 sm:right-4 z-10 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            aria-label="Next image"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
              <path fill-rule="evenodd" d="M16.28 11.47a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 0 1 1.06-1.06l7.5 7.5Z" clip-rule="evenodd" />
            </svg>
          </button>

          <!-- Loading state -->
          <div
            v-if="(isLoading || urlLoading) && !hasError"
            class="absolute inset-0 flex items-center justify-center"
          >
            <div class="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
          </div>

          <!-- Error state -->
          <div
            v-if="hasError"
            class="flex flex-col items-center justify-center text-white/70"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-12 h-12 mb-2">
              <path fill-rule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clip-rule="evenodd" />
            </svg>
            <p>Failed to load image</p>
          </div>

          <!-- Image -->
          <img
            v-if="resolvedUrl && !hasError && currentFile"
            :src="resolvedUrl"
            :alt="currentFile.name"
            @load="handleLoad"
            @error="handleError"
            @click.stop
            class="max-w-full max-h-full object-contain select-none"
            :class="{ 'opacity-0': isLoading || urlLoading }"
            draggable="false"
          />
        </div>

        <!-- Thumbnail strip -->
        <div
          v-if="files.length > 1"
          class="flex-shrink-0 p-4 overflow-x-auto"
        >
          <div class="flex items-center justify-center gap-2">
            <button
              v-for="(file, index) in files"
              :key="index"
              type="button"
              @click.stop="currentIndex = index"
              class="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden border-2 transition-all cursor-pointer"
              :class="index === currentIndex ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'"
            >
              <img
                :src="file.url"
                :alt="file.name"
                class="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          </div>
        </div>

        <!-- File info -->
        <div v-if="currentFile" class="flex-shrink-0 text-center pb-4 text-white/50 text-sm">
          {{ currentFile.name }}
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.lightbox-enter-active,
.lightbox-leave-active {
  transition: opacity 0.2s ease;
}

.lightbox-enter-from,
.lightbox-leave-to {
  opacity: 0;
}
</style>