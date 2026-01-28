<script setup lang="ts">
import type { Message } from '@/types/chat'
import MessageMedia from '@/components/MessageMedia.vue'
import VoiceMessage from '@/components/VoiceMessage.vue'
import ImageGallery from '@/components/ImageGallery.vue'
import ImageLightbox from '@/components/ImageLightbox.vue'

const props = defineProps<{
  message: Message
  isOwnMessage: boolean
}>()

const lightboxOpen = ref(false)
const lightboxIndex = ref(0)

const hasMultipleFiles = computed(() =>
  (props.message.files?.length ?? 0) > 0
)

const imageFiles = computed(() =>
  props.message.files?.filter(f => f.type === 'image') ?? []
)

const formattedTime = computed(() => {
  if (!props.message.createdAt?.toDate) return ''

  const date = props.message.createdAt.toDate()
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })
})

const openLightbox = (index: number): void => {
  lightboxIndex.value = index
  lightboxOpen.value = true
}

const closeLightbox = (): void => {
  lightboxOpen.value = false
}
</script>

<template>
  <div
    class="flex w-full"
    :class="isOwnMessage ? 'justify-end' : 'justify-start'"
  >
    <div
      class="max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2 shadow-sm"
      :class="
        isOwnMessage
          ? 'bg-indigo-600 text-white rounded-br-md'
          : 'bg-white text-slate-800 rounded-bl-md border border-slate-100'
      "
    >
      <p
        v-if="!isOwnMessage"
        class="text-xs font-semibold mb-1"
        :class="isOwnMessage ? 'text-indigo-200' : 'text-indigo-600'"
      >
        {{ message.username }}
      </p>

      <!-- Multiple images gallery -->
      <ImageGallery
        v-if="hasMultipleFiles && imageFiles.length > 0"
        :files="imageFiles"
        :is-own-message="isOwnMessage"
        class="mb-2"
        @open-lightbox="openLightbox"
      />

      <!-- Single file (legacy support) -->
      <MessageMedia
        v-else-if="message.file"
        :file="message.file"
        :is-own-message="isOwnMessage"
        class="mb-2"
      />

      <VoiceMessage
        v-if="message.voice"
        :voice="message.voice"
        :is-own="isOwnMessage"
        class="mb-2"
      />

      <p
        v-if="message.text"
        class="text-sm sm:text-base break-words whitespace-pre-wrap"
      >
        {{ message.text }}
      </p>

      <p
        class="text-[10px] mt-1 text-right"
        :class="isOwnMessage ? 'text-indigo-200' : 'text-slate-400'"
      >
        {{ formattedTime }}
      </p>
    </div>
  </div>

  <!-- Lightbox for viewing images -->
  <ImageLightbox
    v-if="lightboxOpen && imageFiles.length > 0"
    :files="imageFiles"
    :initial-index="lightboxIndex"
    @close="closeLightbox"
  />
</template>