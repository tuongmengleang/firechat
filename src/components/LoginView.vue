<script setup lang="ts">
/**
 * Login View Component
 *
 * Handles user authentication with Firebase.
 * Uses anonymous auth for simplicity.
 */

import { ref } from 'vue'
import { useAuth } from '@/composables/useAuth'

const emit = defineEmits<{
  authenticated: []
}>()

const { signIn, loading, error } = useAuth()

const displayName = ref('')
const isSubmitting = ref(false)
const localError = ref<string | null>(null)

const handleSubmit = async () => {
  const name = displayName.value.trim()

  if (name.length < 2 || name.length > 20) {
    localError.value = 'Name must be 2-20 characters'
    return
  }

  isSubmitting.value = true
  localError.value = null

  try {
    await signIn(name)
    emit('authenticated')
  } catch (e) {
    localError.value = e instanceof Error ? e.message : 'Authentication failed'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <!-- Card -->
      <div class="bg-white rounded-2xl shadow-xl p-8">
        <!-- Logo -->
        <div class="text-center mb-8">
          <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-100 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 text-indigo-600">
              <path fill-rule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clip-rule="evenodd" />
            </svg>
          </div>
          <h1 class="text-2xl font-bold text-slate-800">FireChat E2EE</h1>
          <p class="text-slate-500 mt-2">End-to-end encrypted messaging</p>
        </div>

        <!-- Security Info -->
        <div class="bg-green-50 rounded-xl p-4 mb-6">
          <div class="flex gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 text-green-600 flex-shrink-0">
              <path fill-rule="evenodd" d="M12.516 2.17a.75.75 0 0 0-1.032 0 11.209 11.209 0 0 1-7.877 3.08.75.75 0 0 0-.722.515A12.74 12.74 0 0 0 2.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 0 0 .374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 0 0-.722-.516l-.143.001c-2.996 0-5.717-1.17-7.734-3.08Zm3.094 8.016a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clip-rule="evenodd" />
            </svg>
            <div>
              <p class="font-medium text-green-800">Your messages are secure</p>
              <p class="text-sm text-green-600 mt-1">
                Messages are encrypted on your device before being sent.
                Only you and your chat partner can read them.
              </p>
            </div>
          </div>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div>
            <label for="displayName" class="block text-sm font-medium text-slate-700 mb-2">
              Your display name
            </label>
            <input
              id="displayName"
              v-model="displayName"
              type="text"
              placeholder="Enter your name"
              maxlength="20"
              class="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              :disabled="isSubmitting"
            />
            <p class="text-xs text-slate-400 mt-1">2-20 characters</p>
          </div>

          <!-- Error -->
          <p v-if="localError || error" class="text-red-500 text-sm">
            {{ localError || error }}
          </p>

          <!-- Submit -->
          <button
            type="submit"
            :disabled="isSubmitting || displayName.trim().length < 2"
            class="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            <span v-if="isSubmitting">
              <svg class="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Setting up encryption...
            </span>
            <template v-else>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                <path fill-rule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clip-rule="evenodd" />
              </svg>
              Start Secure Chat
            </template>
          </button>
        </form>

        <!-- Features -->
        <div class="mt-8 pt-6 border-t border-slate-200">
          <div class="grid grid-cols-2 gap-4 text-center">
            <div>
              <div class="w-10 h-10 mx-auto mb-2 rounded-lg bg-slate-100 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5 text-slate-600">
                  <path fill-rule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clip-rule="evenodd" />
                </svg>
              </div>
              <p class="text-xs text-slate-600">AES-256-GCM</p>
            </div>
            <div>
              <div class="w-10 h-10 mx-auto mb-2 rounded-lg bg-slate-100 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5 text-slate-600">
                  <path d="M13.024 9.25c.47 0 .827-.433.637-.863a4 4 0 0 0-4.094-2.364c-.468.05-.665.576-.43.984l1.08 1.868a.75.75 0 0 0 .649.375h2.158ZM7.84 7.758c-.236-.408-.79-.5-1.068-.12A3.982 3.982 0 0 0 6 10c0 .884.287 1.7.772 2.363.278.38.832.287 1.068-.12l1.078-1.868a.75.75 0 0 0 0-.75L7.839 7.758ZM9.138 12.993c-.235.408-.039.934.43.984a4 4 0 0 0 4.094-2.364c.19-.43-.168-.863-.638-.863h-2.158a.75.75 0 0 0-.65.375l-1.078 1.868Z" />
                  <path fill-rule="evenodd" d="M14.13 4.347l.644-1.117a.75.75 0 0 0-1.299-.75l-.644 1.116a6.954 6.954 0 0 0-2.081-.556V1.75a.75.75 0 0 0-1.5 0v1.29a6.954 6.954 0 0 0-2.081.556L6.525 2.48a.75.75 0 1 0-1.3.75l.645 1.117A7.04 7.04 0 0 0 4.347 5.87L3.23 5.225a.75.75 0 1 0-.75 1.3l1.116.644A6.954 6.954 0 0 0 3.04 9.25H1.75a.75.75 0 0 0 0 1.5h1.29c.078.733.27 1.433.556 2.081l-1.116.645a.75.75 0 1 0 .75 1.298l1.117-.644a7.04 7.04 0 0 0 1.523 1.523l-.645 1.117a.75.75 0 1 0 1.3.75l.644-1.116a6.954 6.954 0 0 0 2.081.556v1.29a.75.75 0 0 0 1.5 0v-1.29a6.954 6.954 0 0 0 2.081-.556l.645 1.116a.75.75 0 0 0 1.299-.75l-.645-1.117a7.042 7.042 0 0 0 1.523-1.523l1.117.644a.75.75 0 0 0 .75-1.298l-1.116-.645a6.954 6.954 0 0 0 .556-2.081h1.29a.75.75 0 0 0 0-1.5h-1.29a6.954 6.954 0 0 0-.556-2.081l1.116-.644a.75.75 0 0 0-.75-1.3l-1.117.645a7.04 7.04 0 0 0-1.524-1.523ZM10 4.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z" clip-rule="evenodd" />
                </svg>
              </div>
              <p class="text-xs text-slate-600">ECDH P-256</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <p class="text-center text-white/60 text-xs mt-6">
        Your private keys never leave this device
      </p>
    </div>
  </div>
</template>
