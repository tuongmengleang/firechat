<script setup lang="ts">
import type { FilePreview, UploadState, VoiceAttachment } from '@/types/chat'
import FilePreviewComponent from '@/components/FilePreview.vue'
import UploadProgress from '@/components/UploadProgress.vue'
import VoiceRecorder from '@/components/VoiceRecorder.vue'

const props = defineProps<{
  filePreview?: FilePreview | null
  uploadState?: UploadState
  username: string
  roomId?: string
}>()

const emit = defineEmits<{
  send: [text: string]
  fileSelect: [file: File]
  fileRemove: []
  uploadCancel: []
  voiceSend: [voice: VoiceAttachment]
}>()

const message = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const isVoiceMode = ref(false)

const handleVoiceSend = (voice: VoiceAttachment): void => {
  isVoiceMode.value = false
  emit('voiceSend', voice)
}

const handleVoiceCancel = (): void => {
  isVoiceMode.value = false
}

const isUploading = computed(() => props.uploadState?.isUploading ?? false)
const canSend = computed(() => {
  const hasText = message.value.trim().length > 0
  const hasFile = !!props.filePreview
  return (hasText || hasFile) && !isUploading.value
})

const handleSubmit = (): void => {
  if (!canSend.value) return

  emit('send', message.value.trim())
  message.value = ''

  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto'
    }
  })
}

const handleKeydown = (e: KeyboardEvent): void => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSubmit()
  }
}

const autoResize = (e: Event): void => {
  const target = e.target as HTMLTextAreaElement
  target.style.height = 'auto'
  target.style.height = `${Math.min(target.scrollHeight, 120)}px`
}

const openFilePicker = (): void => {
  fileInputRef.value?.click()
}

const handleFileChange = (e: Event): void => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    emit('fileSelect', file)
  }
  target.value = ''
}
</script>

<template>
  <div class="bg-white border-t border-slate-200">
    <div v-if="filePreview && !uploadState?.isUploading" class="p-3 pb-0">
      <FilePreviewComponent
        :preview="filePreview"
        @remove="emit('fileRemove')"
      />
    </div>

    <div v-if="uploadState?.isUploading" class="p-3 pb-0">
      <UploadProgress
        :state="uploadState"
        @cancel="emit('uploadCancel')"
      />
    </div>

    <form
      @submit.prevent="handleSubmit"
      class="flex items-end gap-2 p-3 sm:p-4"
    >
      <button
        type="button"
        @click="openFilePicker"
        :disabled="isUploading"
        class="flex-shrink-0 rounded-full p-3 text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        aria-label="Attach file"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
          <path
            fill-rule="evenodd"
            d="M1.5 6a2.25 2.25 0 0 1 2.25-2.25h16.5A2.25 2.25 0 0 1 22.5 6v12a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 18V6ZM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0 0 21 18v-1.94l-2.69-2.689a1.5 1.5 0 0 0-2.12 0l-.88.879.97.97a.75.75 0 1 1-1.06 1.06l-5.16-5.159a1.5 1.5 0 0 0-2.12 0L3 16.061Zm10.125-7.81a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Z"
            clip-rule="evenodd"
          />
        </svg>
      </button>

      <input
        ref="fileInputRef"
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm"
        @change="handleFileChange"
        class="hidden"
      />

      <!-- Voice Recorder (integrated into the input area) -->
      <VoiceRecorder
        :room-id="roomId"
        :username="username"
        @send="handleVoiceSend"
        @cancel="handleVoiceCancel"
      />

      <textarea
        ref="textareaRef"
        v-model="message"
        @keydown="handleKeydown"
        @input="autoResize"
        :disabled="isUploading"
        placeholder="Type a message..."
        rows="1"
        class="flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:text-base outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 max-h-[120px] disabled:opacity-50"
      />
      <button
        type="submit"
        :disabled="!canSend"
        class="flex-shrink-0 rounded-full bg-indigo-600 p-3 text-white shadow-md transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        aria-label="Send message"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          class="w-5 h-5"
        >
          <path
            d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z"
          />
        </svg>
      </button>
    </form>
  </div>
</template>
