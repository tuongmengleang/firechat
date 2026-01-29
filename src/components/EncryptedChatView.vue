<script setup lang="ts">
/**
 * Encrypted Chat View Component
 *
 * Displays an E2EE conversation with a specific user.
 * All messages are encrypted/decrypted client-side.
 */

import { ref, watch, nextTick, computed } from 'vue'
import { useEncryptedChat } from '@/composables/useEncryptedChat'
import { useAuth } from '@/composables/useAuth'

const props = defineProps<{
  recipientId: string
  recipientName?: string
}>()

const emit = defineEmits<{
  back: []
}>()

const { displayName } = useAuth()
const { messages, loading, error, sendMessage, conversationId } = useEncryptedChat(props.recipientId)

const messageInput = ref('')
const messagesContainer = ref<HTMLElement | null>(null)
const isSending = ref(false)

// Auto-scroll on new messages
watch(
  () => messages.value.length,
  () => {
    nextTick(() => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
      }
    })
  }
)

const handleSend = async () => {
  const text = messageInput.value.trim()
  if (!text || isSending.value) return

  isSending.value = true
  const username = displayName.value || 'Anonymous'

  try {
    await sendMessage(text, username)
    messageInput.value = ''
  } catch (e) {
    console.error('Failed to send:', e)
  } finally {
    isSending.value = false
  }
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const { uid } = useAuth()
const isOwnMessage = (senderId: string) => senderId === uid.value
</script>

<template>
  <div class="flex flex-col h-full bg-slate-50">
    <!-- Header -->
    <header class="flex-shrink-0 bg-white border-b border-slate-200 px-4 py-3">
      <div class="flex items-center gap-3">
        <button
          @click="emit('back')"
          class="p-2 -ml-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5 text-slate-600">
            <path fill-rule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clip-rule="evenodd" />
          </svg>
        </button>

        <div class="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-indigo-600">
            <path fill-rule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clip-rule="evenodd" />
          </svg>
        </div>

        <div class="flex-1">
          <p class="font-medium text-slate-800">
            {{ recipientName || 'Anonymous' }}
          </p>
          <div class="flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3 text-green-500">
              <path fill-rule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" clip-rule="evenodd" />
            </svg>
            <span class="text-xs text-green-600">End-to-end encrypted</span>
          </div>
        </div>
      </div>
    </header>

    <!-- Messages -->
    <main
      ref="messagesContainer"
      class="flex-1 overflow-y-auto px-4 py-4"
    >
      <!-- Loading -->
      <div v-if="loading" class="flex justify-center py-8">
        <div class="animate-spin w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
      </div>

      <!-- Error -->
      <div v-else-if="error" class="text-center py-8">
        <p class="text-red-500 text-sm">{{ error }}</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="messages.length === 0" class="flex flex-col items-center justify-center h-full text-center">
        <div class="w-16 h-16 mb-4 rounded-full bg-green-100 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 text-green-600">
            <path fill-rule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clip-rule="evenodd" />
          </svg>
        </div>
        <p class="text-slate-600 font-medium">Encrypted conversation</p>
        <p class="text-slate-400 text-sm mt-1">Messages are end-to-end encrypted</p>
        <p class="text-slate-400 text-xs mt-2">Send a message to start chatting</p>
      </div>

      <!-- Messages List -->
      <div v-else class="space-y-3 max-w-2xl mx-auto">
        <div
          v-for="msg in messages"
          :key="msg.id"
          class="flex"
          :class="isOwnMessage(msg.senderId) ? 'justify-end' : 'justify-start'"
        >
          <div
            class="max-w-[80%] rounded-2xl px-4 py-2"
            :class="
              isOwnMessage(msg.senderId)
                ? 'bg-indigo-600 text-white rounded-br-md'
                : 'bg-white text-slate-800 rounded-bl-md shadow-sm'
            "
          >
            <!-- Decryption Failed -->
            <div v-if="msg.decryptionFailed" class="flex items-center gap-2 text-red-400">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4">
                <path fill-rule="evenodd" d="M6.701 2.25c.577-1 2.02-1 2.598 0l5.196 9a1.5 1.5 0 0 1-1.299 2.25H2.804a1.5 1.5 0 0 1-1.3-2.25l5.197-9ZM8 5a.75.75 0 0 1 .75.75v2.5a.75.75 0 0 1-1.5 0v-2.5A.75.75 0 0 1 8 5Zm0 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clip-rule="evenodd" />
              </svg>
              <span class="text-sm italic">Unable to decrypt</span>
            </div>

            <!-- Message Content -->
            <template v-else>
              <p
                v-if="!isOwnMessage(msg.senderId)"
                class="text-xs font-medium mb-1"
                :class="isOwnMessage(msg.senderId) ? 'text-indigo-200' : 'text-indigo-600'"
              >
                {{ msg.senderUsername }}
              </p>
              <p class="whitespace-pre-wrap break-words">{{ msg.text }}</p>
              <p
                class="text-xs mt-1 text-right"
                :class="isOwnMessage(msg.senderId) ? 'text-indigo-200' : 'text-slate-400'"
              >
                {{ formatTime(msg.createdAt) }}
              </p>
            </template>
          </div>
        </div>
      </div>
    </main>

    <!-- Input -->
    <footer class="flex-shrink-0 bg-white border-t border-slate-200 p-4">
      <div class="max-w-2xl mx-auto flex gap-3">
        <input
          v-model="messageInput"
          @keydown="handleKeydown"
          type="text"
          placeholder="Type an encrypted message..."
          class="flex-1 px-4 py-3 bg-slate-100 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
          :disabled="isSending"
        />
        <button
          @click="handleSend"
          :disabled="!messageInput.trim() || isSending"
          class="px-6 py-3 bg-indigo-600 text-white rounded-full font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <span v-if="isSending">
            <svg class="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </span>
          <span v-else>Send</span>
        </button>
      </div>

      <!-- Encryption indicator -->
      <div class="max-w-2xl mx-auto mt-2 flex items-center justify-center gap-1 text-xs text-slate-400">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3">
          <path fill-rule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" clip-rule="evenodd" />
        </svg>
        <span>Messages are encrypted with AES-256-GCM</span>
      </div>
    </footer>
  </div>
</template>
