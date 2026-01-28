import {
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  collection,
  query,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import { TYPING_TIMEOUT, TYPING_THROTTLE, type TypingUser } from '@/types/chat'

export function useTypingIndicator(roomId: string, currentUsername: string) {
  const typingUsers = ref<TypingUser[]>([])
  const isTyping = ref(false)

  let lastTypingBroadcast = 0
  let typingTimeout: ReturnType<typeof setTimeout> | null = null
  let cleanupInterval: ReturnType<typeof setInterval> | null = null

  const typingColRef = collection(db, 'chatRooms', roomId, 'typingIndicators')
  const userDocRef = doc(typingColRef, currentUsername)

  // Subscribe to typing indicators from other users
  const unsubscribe = onSnapshot(
    query(typingColRef),
    (snapshot) => {
      const now = Date.now()
      typingUsers.value = snapshot.docs
        .map((docSnap) => {
          const data = docSnap.data()
          return {
            username: docSnap.id,
            lastTypingAt: data.lastTypingAt?.toMillis?.() ?? data.lastTypingAt ?? 0,
          } as TypingUser
        })
        // Filter out self and expired typing states
        .filter(
          (user) =>
            user.username !== currentUsername &&
            now - user.lastTypingAt < TYPING_TIMEOUT
        )
    },
    (err) => {
      console.error('Typing indicator error:', err)
    }
  )

  // Clean up stale typing users periodically (client-side)
  cleanupInterval = setInterval(() => {
    const now = Date.now()
    typingUsers.value = typingUsers.value.filter(
      (user) => now - user.lastTypingAt < TYPING_TIMEOUT
    )
  }, 1000)

  // Broadcast typing status (throttled)
  const broadcastTyping = async (): Promise<void> => {
    const now = Date.now()
    if (now - lastTypingBroadcast < TYPING_THROTTLE) return

    lastTypingBroadcast = now
    isTyping.value = true

    try {
      await setDoc(userDocRef, {
        lastTypingAt: Timestamp.now(),
      })
    } catch (err) {
      console.error('Failed to broadcast typing:', err)
    }

    // Clear typing status after timeout
    if (typingTimeout) clearTimeout(typingTimeout)
    typingTimeout = setTimeout(() => {
      stopTyping()
    }, TYPING_TIMEOUT)
  }

  // Stop typing indicator
  const stopTyping = async (): Promise<void> => {
    if (!isTyping.value) return
    isTyping.value = false

    if (typingTimeout) {
      clearTimeout(typingTimeout)
      typingTimeout = null
    }

    try {
      await deleteDoc(userDocRef)
    } catch (err) {
      console.error('Failed to clear typing status:', err)
    }
  }

  // Handle input event - call this on textarea input
  const onInput = (): void => {
    broadcastTyping()
  }

  // Handle message sent - immediately clear typing
  const onMessageSent = (): void => {
    stopTyping()
  }

  // Computed property for display text
  const typingText = computed((): string => {
    const users = typingUsers.value
    if (users.length === 0) return ''
    if (users.length === 1) {
      const user = users[0]
      return user ? `${user.username} is typing` : ''
    }
    if (users.length === 2) {
      const [first, second] = users
      return first && second ? `${first.username} and ${second.username} are typing` : ''
    }
    return `${users.length} people are typing`
  })

  const hasTypingUsers = computed((): boolean => typingUsers.value.length > 0)

  // Cleanup on unmount
  onUnmounted(() => {
    unsubscribe()
    if (typingTimeout) clearTimeout(typingTimeout)
    if (cleanupInterval) clearInterval(cleanupInterval)
    // Clean up own typing status
    deleteDoc(userDocRef).catch(() => {})
  })

  return {
    typingUsers,
    typingText,
    hasTypingUsers,
    onInput,
    onMessageSent,
    stopTyping,
  }
}