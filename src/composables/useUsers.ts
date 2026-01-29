/**
 * Users Composable
 *
 * Manages user discovery for starting encrypted conversations.
 * Lists users who have published their public keys.
 */

import { ref, onUnmounted } from 'vue'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db, auth } from '@/config/firebase'

export interface UserWithKey {
  uid: string
  publicKey: string
  displayName: string
  createdAt: number
}

export function useUsers() {
  const users = ref<UserWithKey[]>([])
  const loading = ref(true)
  const error = ref<string | null>(null)

  let unsubscribe: (() => void) | null = null

  function subscribe() {
    const currentUser = auth.currentUser
    if (!currentUser) {
      error.value = 'Must be authenticated'
      loading.value = false
      return
    }

    const publicKeysRef = collection(db, 'publicKeys')

    unsubscribe = onSnapshot(
      publicKeysRef,
      (snapshot) => {
        users.value = snapshot.docs
          .map((doc) => ({
            uid: doc.id,
            publicKey: doc.data().publicKey,
            displayName: doc.data().displayName || 'Anonymous',
            createdAt: doc.data().createdAt,
          }))
          .filter((user) => user.uid !== currentUser.uid) // Exclude self

        loading.value = false
      },
      (err) => {
        console.error('Users subscription error:', err)
        error.value = 'Failed to load users'
        loading.value = false
      }
    )
  }

  subscribe()

  onUnmounted(() => {
    if (unsubscribe) {
      unsubscribe()
    }
  })

  return {
    users,
    loading,
    error,
  }
}

export default useUsers
