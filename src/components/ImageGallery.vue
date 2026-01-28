<script setup lang="ts">
import type { FileAttachment } from '@/types/chat'
import { usePresignedUrl } from '@/composables/usePresignedUrl'

const props = defineProps<{
  files: FileAttachment[]
  isOwnMessage: boolean
}>()

const emit = defineEmits<{
  openLightbox: [index: number]
}>()

const isExpanded = ref(false)
const loadedImages = ref<Set<number>>(new Set())
const errorImages = ref<Set<number>>(new Set())

// Get presigned URLs for all images
const resolvedUrls = computed(() => {
  return props.files.map((file, index) => {
    const { resolvedUrl, isLoading, error } = usePresignedUrl(() => file.url)
    return { url: resolvedUrl, isLoading, error, index }
  })
})

const displayedFiles = computed(() => {
  if (isExpanded.value || props.files.length <= 4) {
    return props.files
  }
  return props.files.slice(0, 4)
})

const hiddenCount = computed(() => {
  if (isExpanded.value || props.files.length <= 4) return 0
  return props.files.length - 4
})

const gridClass = computed(() => {
  const count = displayedFiles.value.length
  if (count === 1) return 'grid-cols-1'
  if (count === 2) return 'grid-cols-2'
  return 'grid-cols-2'
})

const getImageClass = (index: number): string => {
  const count = displayedFiles.value.length

  if (count === 1) {
    return 'aspect-auto max-h-64'
  }

  if (count === 2) {
    return 'aspect-square'
  }

  if (count === 3) {
    if (index === 0) return 'row-span-2 aspect-[3/4]'
    return 'aspect-square'
  }

  // 4 or more
  return 'aspect-square'
}

const handleImageLoad = (index: number): void => {
  loadedImages.value.add(index)
}

const handleImageError = (index: number): void => {
  errorImages.value.add(index)
}

const openImage = (index: number): void => {
  emit('openLightbox', index)
}

const toggleExpand = (): void => {
  isExpanded.value = !isExpanded.value
}
</script>

<template>
  <div class="space-y-1">
    <!-- Image grid -->
    <div
      class="grid gap-1 rounded-lg overflow-hidden"
      :class="gridClass"
    >
      <div
        v-for="(file, index) in displayedFiles"
        :key="index"
        class="relative overflow-hidden cursor-pointer group"
        :class="getImageClass(index)"
        @click="openImage(index)"
      >
        <!-- Loading placeholder -->
        <div
          v-if="resolvedUrls[index]?.isLoading.value || (!loadedImages.has(index) && !errorImages.has(index))"
          class="absolute inset-0 bg-slate-200 animate-pulse flex items-center justify-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 text-slate-400">
            <path fill-rule="evenodd" d="M1.5 6a2.25 2.25 0 0 1 2.25-2.25h16.5A2.25 2.25 0 0 1 22.5 6v12a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 18V6ZM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0 0 21 18v-1.94l-2.69-2.689a1.5 1.5 0 0 0-2.12 0l-.88.879.97.97a.75.75 0 1 1-1.06 1.06l-5.16-5.159a1.5 1.5 0 0 0-2.12 0L3 16.061Zm10.125-7.81a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Z" clip-rule="evenodd" />
          </svg>
        </div>

        <!-- Error state -->
        <div
          v-if="errorImages.has(index) || resolvedUrls[index]?.error.value"
          class="absolute inset-0 bg-slate-100 flex items-center justify-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 text-slate-400">
            <path fill-rule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clip-rule="evenodd" />
          </svg>
        </div>

        <!-- Image -->
        <img
          v-if="resolvedUrls[index]?.url.value && !errorImages.has(index)"
          :src="resolvedUrls[index].url.value"
          :alt="file.name"
          loading="lazy"
          @load="handleImageLoad(index)"
          @error="handleImageError(index)"
          class="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
          :class="{ 'opacity-0': !loadedImages.has(index) }"
        />

        <!-- Hover overlay -->
        <div
          class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            class="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg"
          >
            <path fill-rule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Zm8.25-3.75a.75.75 0 0 1 .75.75v2.25h2.25a.75.75 0 0 1 0 1.5h-2.25v2.25a.75.75 0 0 1-1.5 0v-2.25H7.5a.75.75 0 0 1 0-1.5h2.25V7.5a.75.75 0 0 1 .75-.75Z" clip-rule="evenodd" />
          </svg>
        </div>

        <!-- "More" overlay on last visible image -->
        <div
          v-if="index === 3 && hiddenCount > 0"
          class="absolute inset-0 bg-black/60 flex items-center justify-center cursor-pointer"
          @click.stop="toggleExpand"
        >
          <span class="text-white text-xl font-semibold">+{{ hiddenCount }}</span>
        </div>
      </div>
    </div>

    <!-- Collapse button when expanded -->
    <button
      v-if="isExpanded && files.length > 4"
      type="button"
      @click="toggleExpand"
      class="text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
      :class="isOwnMessage ? 'text-indigo-200 hover:text-white' : ''"
    >
      Show less
    </button>
  </div>
</template>