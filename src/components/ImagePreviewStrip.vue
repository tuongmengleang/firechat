<script setup lang="ts">
import type { ImagePreview, MultipleUploadState } from '@/types/chat'

const props = defineProps<{
  images: ImagePreview[]
  uploadState: MultipleUploadState
  canAddMore: boolean
}>()

const emit = defineEmits<{
  remove: [id: string]
  addMore: []
  cancel: []
}>()

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const getStatusColor = (status: ImagePreview['status']): string => {
  switch (status) {
    case 'uploading':
      return 'border-indigo-500'
    case 'completed':
      return 'border-green-500'
    case 'error':
      return 'border-red-500'
    default:
      return 'border-slate-200'
  }
}
</script>

<template>
  <div class="px-3 pt-3 pb-0">
    <!-- Upload progress bar when uploading -->
    <div v-if="uploadState.isUploading" class="mb-2">
      <div class="flex items-center justify-between text-xs text-slate-600 mb-1">
        <span>Uploading {{ uploadState.completedCount }}/{{ uploadState.totalCount }} images...</span>
        <button
          type="button"
          @click="emit('cancel')"
          class="text-red-500 hover:text-red-600 font-medium cursor-pointer"
        >
          Cancel
        </button>
      </div>
      <div class="h-1 bg-slate-200 rounded-full overflow-hidden">
        <div
          class="h-full bg-indigo-500 transition-all duration-300 ease-out"
          :style="{ width: `${uploadState.totalProgress}%` }"
        />
      </div>
    </div>

    <!-- Image thumbnails strip -->
    <div class="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
      <TransitionGroup name="image-list">
        <div
          v-for="image in images"
          :key="image.id"
          class="relative flex-shrink-0 group"
        >
          <!-- Thumbnail -->
          <div
            class="relative w-16 h-16 rounded-lg overflow-hidden border-2 transition-all duration-200"
            :class="getStatusColor(image.status)"
          >
            <img
              :src="image.url"
              :alt="image.name"
              class="w-full h-full object-cover"
            />

            <!-- Upload progress overlay -->
            <div
              v-if="image.status === 'uploading'"
              class="absolute inset-0 bg-black/50 flex items-center justify-center"
            >
              <div class="w-8 h-8 relative">
                <svg class="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke="rgba(255,255,255,0.3)"
                    stroke-width="3"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke="white"
                    stroke-width="3"
                    stroke-linecap="round"
                    :stroke-dasharray="`${image.progress * 0.88} 88`"
                    class="transition-all duration-200"
                  />
                </svg>
                <span class="absolute inset-0 flex items-center justify-center text-white text-[10px] font-medium">
                  {{ image.progress }}
                </span>
              </div>
            </div>

            <!-- Error overlay -->
            <div
              v-if="image.status === 'error'"
              class="absolute inset-0 bg-red-500/70 flex items-center justify-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5 text-white">
                <path fill-rule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clip-rule="evenodd" />
              </svg>
            </div>

            <!-- Completed checkmark -->
            <div
              v-if="image.status === 'completed'"
              class="absolute inset-0 bg-green-500/70 flex items-center justify-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5 text-white">
                <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" />
              </svg>
            </div>
          </div>

          <!-- Remove button -->
          <button
            v-if="!uploadState.isUploading || image.status === 'error'"
            type="button"
            @click="emit('remove', image.id)"
            class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-800 hover:bg-red-500 text-white flex items-center justify-center shadow-sm transition-all duration-200 opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
            :class="{ 'opacity-100': image.status === 'error' }"
            aria-label="Remove image"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3">
              <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
            </svg>
          </button>

          <!-- File size tooltip on hover -->
          <div
            class="absolute -bottom-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-slate-800 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          >
            {{ formatSize(image.size) }}
          </div>
        </div>
      </TransitionGroup>

      <!-- Add more button -->
      <button
        v-if="canAddMore && !uploadState.isUploading"
        type="button"
        @click="emit('addMore')"
        class="flex-shrink-0 w-16 h-16 rounded-lg border-2 border-dashed border-slate-300 hover:border-indigo-400 flex items-center justify-center text-slate-400 hover:text-indigo-500 transition-colors cursor-pointer"
        aria-label="Add more images"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-6 h-6">
          <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
        </svg>
      </button>
    </div>

    <!-- Image count and clear all -->
    <div
      v-if="images.length > 0 && !uploadState.isUploading"
      class="flex items-center justify-between text-xs text-slate-500 mt-1"
    >
      <span>{{ images.length }} image{{ images.length !== 1 ? 's' : '' }} selected</span>
      <button
        type="button"
        @click="images.forEach(img => emit('remove', img.id))"
        class="text-red-500 hover:text-red-600 cursor-pointer"
      >
        Clear all
      </button>
    </div>

    <!-- Error message -->
    <div
      v-if="uploadState.error && !uploadState.isUploading"
      class="text-xs text-red-500 mt-1"
    >
      {{ uploadState.error }}
    </div>
  </div>
</template>

<style scoped>
.scrollbar-thin {
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 transparent;
}

.scrollbar-thin::-webkit-scrollbar {
  height: 4px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
  border-radius: 2px;
}

/* List animations */
.image-list-enter-active {
  transition: all 0.3s ease-out;
}

.image-list-leave-active {
  transition: all 0.2s ease-in;
}

.image-list-enter-from {
  opacity: 0;
  transform: scale(0.8);
}

.image-list-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

.image-list-move {
  transition: transform 0.3s ease;
}
</style>