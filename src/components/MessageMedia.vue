<script setup lang="ts">
import type { FileAttachment } from '@/types/chat'

const props = defineProps<{
  file: FileAttachment
  isOwnMessage: boolean
}>()

const isLoading = ref(true)
const hasError = ref(false)
const isFullscreen = ref(false)

const handleLoad = (): void => {
  isLoading.value = false
}

const handleError = (): void => {
  isLoading.value = false
  hasError.value = true
}

const openFullscreen = (): void => {
  if (props.file.type === 'image') {
    isFullscreen.value = true
  }
}

const closeFullscreen = (): void => {
  isFullscreen.value = false
}

const handleKeydown = (e: KeyboardEvent): void => {
  if (e.key === 'Escape') {
    closeFullscreen()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="relative rounded-lg overflow-hidden">
    <div
      v-if="isLoading && !hasError"
      class="absolute inset-0 bg-slate-200 animate-pulse flex items-center justify-center"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 text-slate-400">
        <path
          fill-rule="evenodd"
          d="M1.5 6a2.25 2.25 0 0 1 2.25-2.25h16.5A2.25 2.25 0 0 1 22.5 6v12a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 18V6ZM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0 0 21 18v-1.94l-2.69-2.689a1.5 1.5 0 0 0-2.12 0l-.88.879.97.97a.75.75 0 1 1-1.06 1.06l-5.16-5.159a1.5 1.5 0 0 0-2.12 0L3 16.061Zm10.125-7.81a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Z"
          clip-rule="evenodd"
        />
      </svg>
    </div>

    <div
      v-if="hasError"
      class="flex items-center justify-center p-4 bg-slate-100 rounded-lg"
    >
      <div class="text-center">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 text-slate-400 mx-auto mb-2">
          <path
            fill-rule="evenodd"
            d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
            clip-rule="evenodd"
          />
        </svg>
        <p class="text-xs text-slate-500">Failed to load media</p>
      </div>
    </div>

    <template v-if="!hasError">
      <img
        v-if="file.type === 'image'"
        :src="file.url"
        :alt="file.name"
        @load="handleLoad"
        @error="handleError"
        @click="openFullscreen"
        class="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
        :class="{ 'opacity-0': isLoading }"
      />
      <video
        v-else
        :src="file.url"
        @loadeddata="handleLoad"
        @error="handleError"
        controls
        class="max-w-full rounded-lg"
        :class="{ 'opacity-0': isLoading }"
      />
    </template>
  </div>

  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="isFullscreen"
        class="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
        @click="closeFullscreen"
      >
        <button
          class="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
            <path
              fill-rule="evenodd"
              d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z"
              clip-rule="evenodd"
            />
          </svg>
        </button>
        <img
          :src="file.url"
          :alt="file.name"
          class="max-w-full max-h-full object-contain"
          @click.stop
        />
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
