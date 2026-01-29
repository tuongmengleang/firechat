<script setup lang="ts">
/**
 * Conversation List Component
 *
 * Shows available users to start encrypted conversations with.
 * Only shows users who have published their public keys.
 */

import { computed } from 'vue'
import { useUsers } from '@/composables/useUsers'

const props = defineProps<{
  selectedUserId?: string | null
}>()

const emit = defineEmits<{
  select: [userId: string, displayName: string]
}>()

const { users, loading, error } = useUsers()

const sortedUsers = computed(() => {
  return [...users.value].sort((a, b) => b.createdAt - a.createdAt)
})
</script>

<template>
  <div class="bg-white border-r border-slate-200 h-full flex flex-col">
    <!-- Header -->
    <div class="p-4 border-b border-slate-200">
      <h2 class="font-semibold text-slate-800">Conversations</h2>
      <p class="text-xs text-slate-500 mt-1">End-to-end encrypted</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="animate-spin w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="flex-1 flex items-center justify-center p-4">
      <p class="text-red-500 text-sm text-center">{{ error }}</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="users.length === 0" class="flex-1 flex items-center justify-center p-4">
      <div class="text-center">
        <div class="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 text-slate-400">
            <path fill-rule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A12.696 12.696 0 0 1 12 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 0 1-.372-.568 6.787 6.787 0 0 1 1.019-4.38Z" clip-rule="evenodd" />
            <path d="M5.082 14.254a8.287 8.287 0 0 0-1.308 5.135 9.687 9.687 0 0 1-1.764-.44l-.115-.04a.563.563 0 0 1-.373-.487l-.01-.121a3.75 3.75 0 0 1 3.57-4.047ZM20.226 19.389a8.287 8.287 0 0 0-1.308-5.135 3.75 3.75 0 0 1 3.57 4.047l-.01.121a.563.563 0 0 1-.373.486l-.115.04c-.567.2-1.156.349-1.764.441Z" />
          </svg>
        </div>
        <p class="text-slate-500 text-sm">No other users yet</p>
        <p class="text-slate-400 text-xs mt-1">Waiting for others to join...</p>
      </div>
    </div>

    <!-- User List -->
    <div v-else class="flex-1 overflow-y-auto">
      <button
        v-for="user in sortedUsers"
        :key="user.uid"
        @click="emit('select', user.uid, user.displayName)"
        class="w-full p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors border-b border-slate-100"
        :class="{ 'bg-indigo-50': selectedUserId === user.uid }"
      >
        <div class="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-indigo-600">
            <path fill-rule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="flex-1 text-left min-w-0">
          <p class="font-medium text-slate-800 truncate">
            {{ user.displayName }}
          </p>
          <div class="flex items-center gap-1 mt-0.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3 text-green-500">
              <path fill-rule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" clip-rule="evenodd" />
            </svg>
            <span class="text-xs text-green-600">Encrypted</span>
          </div>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5 text-slate-400">
          <path fill-rule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
        </svg>
      </button>
    </div>
  </div>
</template>