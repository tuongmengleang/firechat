<script setup lang="ts">
import type { FilePreview, UploadState, VoiceAttachment, ImagePreview, MultipleUploadState } from '@/types/chat'
import FilePreviewComponent from '@/components/FilePreview.vue'
import UploadProgress from '@/components/UploadProgress.vue'
import VoiceRecorder from '@/components/VoiceRecorder.vue'
import ImagePreviewStrip from '@/components/ImagePreviewStrip.vue'

const props = defineProps<{
  filePreview?: FilePreview | null
  uploadState?: UploadState
  imagePreviews?: ImagePreview[]
  multipleUploadState?: MultipleUploadState
  username: string
  roomId?: string
}>()

const emit = defineEmits<{
  send: [text: string]
  fileSelect: [file: File]
  fileRemove: []
  uploadCancel: []
  voiceSend: [voice: VoiceAttachment]
  imagesSelect: [files: FileList]
  imageRemove: [id: string]
  imagesUploadCancel: []
  typing: []
}>()

const message = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const imageInputRef = ref<HTMLInputElement | null>(null)
const isVoiceMode = ref(false)
const isDragOver = ref(false)

const handleVoiceSend = (voice: VoiceAttachment): void => {
  isVoiceMode.value = false
  emit('voiceSend', voice)
}

const handleVoiceCancel = (): void => {
  isVoiceMode.value = false
}

const isUploading = computed(() =>
  props.uploadState?.isUploading || props.multipleUploadState?.isUploading
)

const hasImages = computed(() =>
  (props.imagePreviews?.length ?? 0) > 0
)

const canAddMoreImages = computed(() =>
  (props.imagePreviews?.length ?? 0) < 10
)

const canSend = computed(() => {
  const hasText = message.value.trim().length > 0
  const hasFile = !!props.filePreview
  const hasImagePreviews = hasImages.value
  return (hasText || hasFile || hasImagePreviews) && !isUploading.value
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
  // Emit typing event
  emit('typing')
}

const openFilePicker = (): void => {
  fileInputRef.value?.click()
}

const openImagePicker = (): void => {
  imageInputRef.value?.click()
}

const handleFileChange = (e: Event): void => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    emit('fileSelect', file)
  }
  target.value = ''
}

const handleImageChange = (e: Event): void => {
  const target = e.target as HTMLInputElement
  const files = target.files
  if (files && files.length > 0) {
    emit('imagesSelect', files)
  }
  target.value = ''
}

// Drag and drop handlers
const handleDragOver = (e: DragEvent): void => {
  e.preventDefault()
  isDragOver.value = true
}

const handleDragLeave = (e: DragEvent): void => {
  e.preventDefault()
  isDragOver.value = false
}

const handleDrop = (e: DragEvent): void => {
  e.preventDefault()
  isDragOver.value = false

  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return

  // Filter only image files
  const imageFiles = Array.from(files).filter(file =>
    file.type.startsWith('image/')
  )

  if (imageFiles.length > 0) {
    // Create a new FileList-like object
    const dt = new DataTransfer()
    imageFiles.forEach(file => dt.items.add(file))
    emit('imagesSelect', dt.files)
  } else if (files.length === 1 && files[0]) {
    // Single non-image file (video, etc.)
    emit('fileSelect', files[0])
  }
}

const handleImageRemove = (id: string): void => {
  emit('imageRemove', id)
}

const handleAddMoreImages = (): void => {
  openImagePicker()
}
</script>

<template>
  <div
    class="max-w-3xl mx-auto"
    :class="{ 'bg-indigo-50 border-indigo-200': isDragOver }"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <!-- Drag overlay -->
    <div
      v-if="isDragOver"
      class="px-4 py-3 text-center text-indigo-600 font-medium text-sm border-2 border-dashed border-indigo-300 mx-3 mt-3 rounded-lg bg-indigo-50/50"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 mx-auto mb-1">
        <path fill-rule="evenodd" d="M1.5 6a2.25 2.25 0 0 1 2.25-2.25h16.5A2.25 2.25 0 0 1 22.5 6v12a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 18V6ZM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0 0 21 18v-1.94l-2.69-2.689a1.5 1.5 0 0 0-2.12 0l-.88.879.97.97a.75.75 0 1 1-1.06 1.06l-5.16-5.159a1.5 1.5 0 0 0-2.12 0L3 16.061Zm10.125-7.81a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Z" clip-rule="evenodd" />
      </svg>
      Drop images here
    </div>

    <!-- Multiple image preview strip -->
    <ImagePreviewStrip
      v-if="hasImages && !isDragOver"
      :images="imagePreviews ?? []"
      :upload-state="multipleUploadState ?? { isUploading: false, totalProgress: 0, completedCount: 0, totalCount: 0, error: null }"
      :can-add-more="canAddMoreImages"
      @remove="handleImageRemove"
      @add-more="handleAddMoreImages"
      @cancel="emit('imagesUploadCancel')"
    />

    <!-- Single file preview (for videos) -->
    <div v-if="filePreview && !uploadState?.isUploading && !hasImages" class="p-3 pb-0">
      <FilePreviewComponent
        :preview="filePreview"
        @remove="emit('fileRemove')"
      />
    </div>

    <div v-if="uploadState?.isUploading && !hasImages" class="p-3 pb-0">
      <UploadProgress
        :state="uploadState"
        @cancel="emit('uploadCancel')"
      />
    </div>

    <form
      @submit.prevent="handleSubmit"
      class="flex items-end gap-2 p-3 sm:p-4"
    >
      <!-- Image picker button -->
      <button
        type="button"
        @click="openImagePicker"
        :disabled="isUploading || !canAddMoreImages"
        class="flex-shrink-0 rounded-full p-3 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        aria-label="Add images"
        title="Add images"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
          <path fill-rule="evenodd" d="M1.5 6a2.25 2.25 0 0 1 2.25-2.25h16.5A2.25 2.25 0 0 1 22.5 6v12a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 18V6ZM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0 0 21 18v-1.94l-2.69-2.689a1.5 1.5 0 0 0-2.12 0l-.88.879.97.97a.75.75 0 1 1-1.06 1.06l-5.16-5.159a1.5 1.5 0 0 0-2.12 0L3 16.061Zm10.125-7.81a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Z" clip-rule="evenodd" />
        </svg>
      </button>

      <!-- Video/file picker button -->
      <button
        v-if="false"
        type="button"
        @click="openFilePicker"
        :disabled="isUploading || hasImages"
        class="flex-shrink-0 rounded-full p-3 text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        aria-label="Attach file"
        title="Attach video"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
          <path fill-rule="evenodd" d="M18.97 3.659a2.25 2.25 0 0 0-3.182 0l-10.94 10.94a3.75 3.75 0 1 0 5.304 5.303l7.693-7.693a.75.75 0 0 1 1.06 1.06l-7.693 7.693a5.25 5.25 0 1 1-7.424-7.424l10.939-10.94a3.75 3.75 0 1 1 5.303 5.304L9.097 18.835l-.008.008-.007.007a2.25 2.25 0 0 1-3.182-3.182l.006-.006.006-.007 7.693-7.693a.75.75 0 0 1 1.06 1.06l-7.693 7.693a.75.75 0 0 0 1.06 1.06l10.94-10.94a2.25 2.25 0 0 0 0-3.182Z" clip-rule="evenodd" />
        </svg>
      </button>

      <!-- Hidden file inputs -->
      <input
        ref="fileInputRef"
        type="file"
        accept="video/mp4,video/webm"
        @change="handleFileChange"
        class="hidden"
      />

      <input
        ref="imageInputRef"
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple
        @change="handleImageChange"
        class="hidden"
      />

      <!-- Voice Recorder -->
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
        :class="[
            'flex-1 resize-none rounded-2xl border px-4 py-3 text-sm sm:text-base outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 max-h-[120px] disabled:opacity-50',
            isDragOver ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200'
        ]"
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
