/**
 * Authentication Composable
 *
 * Manages Firebase Authentication state.
 * Uses anonymous auth for simplicity, but can be extended to email/password or OAuth.
 */

import { ref, computed, onMounted } from 'vue'
import {
  signInAnonymously,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { auth } from '@/config/firebase'
import { clearNonces } from '@/services/crypto'
import { clearAllKeys } from '@/services/keyStorage'

// Global state
const user = ref<User | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

// Initialize auth state listener once
let initialized = false

function initAuthListener() {
  if (initialized) return
  initialized = true

  onAuthStateChanged(auth, (newUser) => {
    user.value = newUser
    loading.value = false
  })
}

export function useAuth() {
  // Ensure listener is set up
  initAuthListener()

  /**
   * Sign in anonymously and set display name
   */
  async function signIn(displayName: string): Promise<User> {
    error.value = null
    loading.value = true

    try {
      const result = await signInAnonymously(auth)

      // Set display name
      if (displayName) {
        await updateProfile(result.user, { displayName })
      }

      user.value = result.user
      return result.user
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Sign in failed'
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * Sign out and clear local keys
   */
  async function signOut(): Promise<void> {
    try {
      // Clear crypto state
      clearNonces()
      await clearAllKeys()

      // Sign out from Firebase
      await firebaseSignOut(auth)
      user.value = null
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Sign out failed'
      throw e
    }
  }

  /**
   * Update user's display name
   */
  async function updateDisplayName(displayName: string): Promise<void> {
    if (!user.value) throw new Error('Not authenticated')

    await updateProfile(user.value, { displayName })
    // Trigger reactivity
    user.value = { ...user.value } as User
  }

  return {
    user: computed(() => user.value),
    uid: computed(() => user.value?.uid ?? null),
    displayName: computed(() => user.value?.displayName ?? null),
    isAuthenticated: computed(() => !!user.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),

    signIn,
    signOut,
    updateDisplayName,
  }
}

export default useAuth
