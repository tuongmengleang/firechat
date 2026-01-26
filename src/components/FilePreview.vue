<script setup lang="ts">
import type { FilePreview } from '@/types/chat'

defineProps<{
  preview: FilePreview
}>()

const emit = defineEmits<{
  remove: []
}>()

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<template>
  <div class="relative inline-block rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
    <img
      v-if="preview.type === 'image'"
      :src="preview.url"
      :alt="preview.name"
      class="max-w-[200px] max-h-[150px] object-cover"
    />
    <video
      v-else
      :src="preview.url"
      class="max-w-[200px] max-h-[150px] object-cover"
      muted
    />

    <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
      <p class="text-white text-xs truncate">{{ preview.name }}</p>
      <p class="text-white/70 text-[10px]">{{ formatSize(preview.size) }}</p>
    </div>

    <button
      type="button"
      @click="emit('remove')"
      class="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors cursor-pointer"
      aria-label="Remove file"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
        <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
      </svg>
    </button>
  </div>
</template>
