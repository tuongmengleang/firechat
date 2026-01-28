import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import type { Message, MessageInput } from '@/types/chat'

export function useChat(roomId: string = 'general', messageLimit: number = 100) {
  const messages = ref<Message[]>([])
  const error = ref<string | null>(null)
  const loading = ref(true)

  const colRef = collection(db, 'chatRooms', roomId, 'messages')

  const q = query(
    colRef,
    orderBy('createdAt', 'asc'),
    limit(messageLimit)
  )

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      messages.value = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Message[]
      loading.value = false
    },
    (err) => {
      console.error('Chat error:', err)
      error.value = 'Failed to load messages'
      loading.value = false
    }
  )

  onUnmounted(() => unsubscribe())

  const sendMessage = async (input: MessageInput): Promise<void> => {
    const hasText = input.text?.trim()
    const hasFile = input.file
    const hasFiles = input.files && input.files.length > 0
    const hasVoice = input.voice

    if (!hasText && !hasFile && !hasFiles && !hasVoice) return

    error.value = null
    try {
      const messageData: Record<string, unknown> = {
        username: input.username,
        createdAt: Timestamp.now(),
      }

      if (hasText) {
        messageData.text = input.text!.trim()
      }

      if (hasFile) {
        messageData.file = input.file
      }

      if (hasFiles) {
        messageData.files = input.files
      }

      if (hasVoice) {
        messageData.voice = input.voice
      }

      await addDoc(colRef, messageData)
    } catch (err) {
      console.error('Send error:', err)
      error.value = 'Failed to send message'
      throw err
    }
  }

  return {
    messages,
    error,
    loading,
    sendMessage,
  }
}
