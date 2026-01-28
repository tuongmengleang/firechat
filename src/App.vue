<script setup lang="ts">
import { useChat } from '@/composables/useChat'
import { useAutoScroll } from '@/composables/useAutoScroll'
import { useFileUpload } from '@/composables/useFileUpload'
import { useMultipleImageUpload } from '@/composables/useMultipleImageUpload'
import { useTypingIndicator } from '@/composables/useTypingIndicator'
import ChatMessage from '@/components/ChatMessage.vue'
import ChatInput from '@/components/ChatInput.vue'
import UsernameModal from '@/components/UsernameModal.vue'
import TypingIndicator from '@/components/TypingIndicator.vue'
import type { VoiceAttachment } from '@/types/chat'

const STORAGE_KEY = 'firechat_username'

const username = ref<string | null>(localStorage.getItem(STORAGE_KEY))
const messagesContainer = ref<HTMLElement | null>(null)

const { messages, error, loading, sendMessage } = useChat('general')
const { isNearBottom, scrollToBottom, scrollToBottomIfNear, onScroll } = useAutoScroll(messagesContainer)
const { filePreview, uploadState, selectFile, clearFile, cancelUpload, uploadFile } = useFileUpload('general')
const {
  imagePreviews,
  uploadState: multipleUploadState,
  hasImages,
  addImages,
  removeImage,
  cancelUpload: cancelImagesUpload,
  uploadImages,
} = useMultipleImageUpload('general')

// Typing indicator state - managed separately to handle username availability
const typingText = ref('')
const hasTypingUsers = ref(false)
let typingOnInput: (() => void) | null = null
let typingOnMessageSent: (() => void) | null = null

// Initialize typing indicator when username becomes available
watch(
  username,
  (newUsername) => {
    if (newUsername) {
      const indicator = useTypingIndicator('general', newUsername)
      typingOnInput = indicator.onInput
      typingOnMessageSent = indicator.onMessageSent

      // Sync reactive state
      watchEffect(() => {
        typingText.value = indicator.typingText.value
        hasTypingUsers.value = indicator.hasTypingUsers.value
      })
    }
  },
  { immediate: true }
)

const handleTyping = (): void => {
  typingOnInput?.()
}

const setUsername = (name: string): void => {
  username.value = name
  localStorage.setItem(STORAGE_KEY, name)
}

const handleFileSelect = (file: File): void => {
  selectFile(file)
}

const handleImagesSelect = (files: FileList): void => {
  addImages(files)
}

const handleImageRemove = (id: string): void => {
  removeImage(id)
}

const handleSend = async (text: string): Promise<void> => {
  if (!username.value) return

  // Clear typing indicator immediately
  typingOnMessageSent?.()

  try {
    let fileAttachment = null
    let filesAttachments = null

    // Handle multiple images upload
    if (hasImages.value) {
      filesAttachments = await uploadImages(username.value)
      if (filesAttachments.length === 0 && multipleUploadState.value.error) {
        return
      }
    }
    // Handle single file upload (videos)
    else if (filePreview.value) {
      fileAttachment = await uploadFile(username.value)
      if (!fileAttachment && uploadState.value.error) {
        return
      }
    }

    if (text || fileAttachment || (filesAttachments && filesAttachments.length > 0)) {
      await sendMessage({
        text: text || undefined,
        username: username.value,
        file: fileAttachment || undefined,
        files: filesAttachments && filesAttachments.length > 0 ? filesAttachments : undefined,
      })
    }
  } catch {
    // Error handled in composables
  }
}

const handleVoiceSend = async (voice: VoiceAttachment): Promise<void> => {
  if (!username.value) return

  // Clear typing indicator
  typingOnMessageSent?.()

  try {
    await sendMessage({
      username: username.value,
      voice,
    })
  } catch {
    // Error handled in composables
  }
}

const isInitialLoad = ref(true)

watch(
  () => messages.value.length,
  (newLength, oldLength) => {
    // On initial load (first batch of messages), use instant scroll
    if (isInitialLoad.value && newLength > 0) {
      isInitialLoad.value = false
      nextTick(() => scrollToBottom('instant'))
      return
    }
    // For subsequent new messages, use smooth scroll if near bottom
    if (newLength > oldLength) {
      scrollToBottomIfNear()
    }
  },
  { flush: 'post' }
)
</script>

<template>
  <UsernameModal v-if="!username" @submit="setUsername" />

  <div class="flex flex-col h-[100dvh] bg-slate-100">
    <!-- Header -->
    <header class="flex-shrink-0 bg-indigo-600 text-white px-4 py-3 shadow-md">
      <div class="max-w-3xl mx-auto flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
              <path
                fill-rule="evenodd"
                d="M4.848 2.771A49.144 49.144 0 0 1 12 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 0 1-3.476.383.39.39 0 0 0-.297.17l-2.755 4.133a.75.75 0 0 1-1.248 0l-2.755-4.133a.39.39 0 0 0-.297-.17 48.9 48.9 0 0 1-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97Z"
                clip-rule="evenodd"
              />
            </svg>
          </div>
          <div>
            <h1 class="font-bold text-lg">Susadei</h1>
            <p class="text-xs text-indigo-200">Real-time messaging</p>
          </div>
        </div>
        <div v-if="username" class="text-right">
          <p class="text-xs text-indigo-200">Logged in as</p>
          <p class="font-semibold text-sm">{{ username }}</p>
        </div>
      </div>
    </header>

    <!-- Messages Area -->
    <main
      ref="messagesContainer"
      @scroll="onScroll"
      class="flex-1 overflow-y-auto px-3 py-4 sm:px-4"
    >
      <div class="max-w-3xl mx-auto space-y-3">
        <!-- Loading State -->
        <div v-if="loading" class="flex justify-center py-8">
          <div class="animate-spin w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="text-center py-8">
          <p class="text-red-500 text-sm">{{ error }}</p>
        </div>

        <!-- Empty State -->
        <div v-else-if="messages.length === 0" class="text-center py-12">
          <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-200 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 text-slate-400">
              <path
                fill-rule="evenodd"
                d="M4.848 2.771A49.144 49.144 0 0 1 12 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 0 1-3.476.383.39.39 0 0 0-.297.17l-2.755 4.133a.75.75 0 0 1-1.248 0l-2.755-4.133a.39.39 0 0 0-.297-.17 48.9 48.9 0 0 1-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97Z"
                clip-rule="evenodd"
              />
            </svg>
          </div>
          <p class="text-slate-500 font-medium">No messages yet</p>
          <p class="text-slate-400 text-sm">Be the first to say hello!</p>
        </div>

        <!-- Messages List -->
        <template v-else>
          <ChatMessage
            v-for="msg in messages"
            :key="msg.id"
            :message="msg"
            :is-own-message="msg.username === username"
          />
        </template>

        <!-- Typing Indicator -->
        <TypingIndicator
          :text="typingText"
          :visible="hasTypingUsers"
        />
      </div>
    </main>

    <!-- Scroll to Bottom Button -->
    <Transition name="fade">
      <button
        v-if="!isNearBottom && messages.length > 0"
        @click="scrollToBottom()"
        class="fixed bottom-24 right-4 sm:right-8 z-10 rounded-full bg-white p-3 shadow-lg border border-slate-200 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
        aria-label="Scroll to bottom"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5 text-slate-600">
          <path
            fill-rule="evenodd"
            d="M10 3a.75.75 0 0 1 .75.75v10.638l3.96-4.158a.75.75 0 1 1 1.08 1.04l-5.25 5.5a.75.75 0 0 1-1.08 0l-5.25-5.5a.75.75 0 1 1 1.08-1.04l3.96 4.158V3.75A.75.75 0 0 1 10 3Z"
            clip-rule="evenodd"
          />
        </svg>
      </button>
    </Transition>

    <!-- Input Area -->
    <div class="flex-shrink-0 mx-auto w-full bg-white border-t border-slate-200 transition-colors">
      <ChatInput
        :file-preview="filePreview"
        :upload-state="uploadState"
        :image-previews="imagePreviews"
        :multiple-upload-state="multipleUploadState"
        :username="username || ''"
        room-id="general"
        @send="handleSend"
        @file-select="handleFileSelect"
        @file-remove="clearFile"
        @upload-cancel="cancelUpload"
        @voice-send="handleVoiceSend"
        @images-select="handleImagesSelect"
        @image-remove="handleImageRemove"
        @images-upload-cancel="cancelImagesUpload"
        @typing="handleTyping"
      />
    </div>
  </div>
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
