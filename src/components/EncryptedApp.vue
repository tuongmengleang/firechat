<script setup lang="ts">
/**
 * Encrypted App Component
 *
 * Main container for the E2EE chat application.
 * Handles authentication, encryption initialization, and navigation.
 */

import { ref, onMounted, watch } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useEncryption } from '@/composables/useEncryption'
import LoginView from '@/components/LoginView.vue'
import ConversationList from '@/components/ConversationList.vue'
import EncryptedChatView from '@/components/EncryptedChatView.vue'

const { isAuthenticated, displayName, signOut, loading: authLoading } = useAuth()
const { initializeEncryption, isInitialized, isInitializing, initError } = useEncryption()

const selectedUserId = ref<string | null>(null)
const selectedUserName = ref<string | null>(null)
const encryptionReady = ref(false)

// Initialize encryption after authentication
watch(isAuthenticated, async (authenticated) => {
  if (authenticated && !encryptionReady.value) {
    try {
      await initializeEncryption()
      encryptionReady.value = true
    } catch (e) {
      console.error('Encryption init failed:', e)
    }
  }
})

const handleAuthenticated = async () => {
  try {
    await initializeEncryption()
    encryptionReady.value = true
  } catch (e) {
    console.error('Encryption init failed:', e)
  }
}

const handleSelectUser = (userId: string, userName?: string) => {
  selectedUserId.value = userId
  selectedUserName.value = userName || null
}

const handleBack = () => {
  selectedUserId.value = null
  selectedUserName.value = null
}

const handleSignOut = async () => {
  try {
    await signOut()
    selectedUserId.value = null
    encryptionReady.value = false
  } catch (e) {
    console.error('Sign out failed:', e)
  }
}
</script>

<template>
  <!-- Loading -->
  <div v-if="authLoading" class="min-h-screen bg-slate-100 flex items-center justify-center">
    <div class="text-center">
      <div class="animate-spin w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full mx-auto" />
      <p class="text-slate-500 mt-4">Loading...</p>
    </div>
  </div>

  <!-- Not authenticated -->
  <LoginView v-else-if="!isAuthenticated" @authenticated="handleAuthenticated" />

  <!-- Initializing encryption -->
  <div v-else-if="isInitializing" class="min-h-screen bg-slate-100 flex items-center justify-center">
    <div class="text-center">
      <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-100 flex items-center justify-center">
        <svg class="w-8 h-8 text-indigo-600 animate-pulse" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          <path fill-rule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clip-rule="evenodd" />
        </svg>
      </div>
      <p class="text-slate-600 font-medium">Setting up encryption...</p>
      <p class="text-slate-400 text-sm mt-1">Generating secure keys</p>
    </div>
  </div>

  <!-- Encryption error -->
  <div v-else-if="initError" class="min-h-screen bg-slate-100 flex items-center justify-center p-4">
    <div class="bg-white rounded-xl shadow-lg p-6 max-w-md text-center">
      <div class="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 text-red-600">
          <path fill-rule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clip-rule="evenodd" />
        </svg>
      </div>
      <h2 class="text-lg font-semibold text-slate-800">Encryption Error</h2>
      <p class="text-slate-500 text-sm mt-2">{{ initError }}</p>
      <button
        @click="handleSignOut"
        class="mt-4 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
      >
        Try Again
      </button>
    </div>
  </div>

  <!-- Main App -->
  <div v-else class="min-h-screen bg-slate-100 flex flex-col">
    <!-- Header -->
    <header class="bg-indigo-600 text-white px-4 py-3 shadow-md flex-shrink-0">
      <div class="max-w-6xl mx-auto flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
              <path fill-rule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clip-rule="evenodd" />
            </svg>
          </div>
          <div>
            <h1 class="font-bold text-lg">FireChat E2EE</h1>
            <p class="text-xs text-indigo-200">End-to-end encrypted</p>
          </div>
        </div>

        <div class="flex items-center gap-4">
          <div class="text-right hidden sm:block">
            <p class="text-xs text-indigo-200">Signed in as</p>
            <p class="font-medium text-sm">{{ displayName }}</p>
          </div>
          <button
            @click="handleSignOut"
            class="p-2 hover:bg-indigo-500 rounded-lg transition-colors"
            title="Sign out"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
              <path fill-rule="evenodd" d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z" clip-rule="evenodd" />
              <path fill-rule="evenodd" d="M19 10a.75.75 0 0 0-.75-.75H8.704l1.048-.943a.75.75 0 1 0-1.004-1.114l-2.5 2.25a.75.75 0 0 0 0 1.114l2.5 2.25a.75.75 0 1 0 1.004-1.114l-1.048-.943h9.546A.75.75 0 0 0 19 10Z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </header>

    <!-- Content -->
    <main class="flex-1 flex overflow-hidden">
      <!-- Desktop: Side by side -->
      <div class="hidden md:flex w-full max-w-6xl mx-auto">
        <!-- Conversation List -->
        <div class="w-80 flex-shrink-0">
          <ConversationList
            :selected-user-id="selectedUserId"
            @select="handleSelectUser"
          />
        </div>

        <!-- Chat View -->
        <div class="flex-1 border-l border-slate-200">
          <EncryptedChatView
            v-if="selectedUserId"
            :key="selectedUserId"
            :recipient-id="selectedUserId"
            :recipient-name="selectedUserName"
            @back="handleBack"
          />
          <div v-else class="h-full flex items-center justify-center bg-slate-50">
            <div class="text-center">
              <div class="w-20 h-20 mx-auto mb-4 rounded-full bg-slate-200 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-10 h-10 text-slate-400">
                  <path fill-rule="evenodd" d="M4.848 2.771A49.144 49.144 0 0 1 12 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 0 1-3.476.383.39.39 0 0 0-.297.17l-2.755 4.133a.75.75 0 0 1-1.248 0l-2.755-4.133a.39.39 0 0 0-.297-.17 48.9 48.9 0 0 1-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97Z" clip-rule="evenodd" />
                </svg>
              </div>
              <p class="text-slate-500 font-medium">Select a conversation</p>
              <p class="text-slate-400 text-sm mt-1">Choose a user from the list to start chatting</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Mobile: Stack -->
      <div class="md:hidden w-full">
        <EncryptedChatView
          v-if="selectedUserId"
          :key="selectedUserId"
          :recipient-id="selectedUserId"
          :recipient-name="selectedUserName"
          @back="handleBack"
        />
        <ConversationList
          v-else
          :selected-user-id="selectedUserId"
          @select="handleSelectUser"
        />
      </div>
    </main>
  </div>
</template>
