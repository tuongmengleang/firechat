<script setup lang="ts">
import type { UploadState } from '@/types/chat'

defineProps<{
  state: UploadState
}>()

const emit = defineEmits<{
  cancel: []
}>()
</script>

<template>
  <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
    <div class="flex-1">
      <div class="flex items-center justify-between mb-1">
        <span class="text-sm text-slate-600">
          {{ state.error ? 'Upload failed' : 'Uploading...' }}
        </span>
        <span class="text-sm font-medium text-indigo-600">{{ state.progress }}%</span>
      </div>
      <div class="h-2 bg-slate-200 rounded-full overflow-hidden">
        <div
          class="h-full transition-all duration-200"
          :class="state.error ? 'bg-red-500' : 'bg-indigo-600'"
          :style="{ width: `${state.progress}%` }"
        />
      </div>
      <p v-if="state.error" class="text-xs text-red-500 mt-1">{{ state.error }}</p>
    </div>
    <button
      v-if="!state.error"
      type="button"
      @click="emit('cancel')"
      class="flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
      aria-label="Cancel upload"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
        <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
      </svg>
    </button>
  </div>
</template>
