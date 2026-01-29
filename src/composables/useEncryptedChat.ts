/**
 * Encrypted Chat Composable
 *
 * Provides E2EE messaging for one-to-one conversations.
 * Messages are encrypted before sending and decrypted on receive.
 *
 * Firestore Schema (encrypted messages):
 * conversations/{conversationId}/messages/{messageId}
 *   - senderId: string (Firebase UID)
 *   - senderUsername: string
 *   - recipientId: string (Firebase UID)
 *   - conversationId: string
 *   - createdAt: number (timestamp)
 *   - encrypted: { ciphertext, iv, version }
 *   - messageNonce: string
 */

import { ref, onUnmounted, computed, watch } from 'vue'
import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
  Timestamp,
} from 'firebase/firestore'
import { db, auth } from '@/config/firebase'
import type { EncryptedMessage, DecryptedMessage, ConversationMeta } from '@/types/encryption'
import {
  useEncryption,
  encryptMessage,
  decryptMessage,
  createConversationId,
} from '@/composables/useEncryption'

// ============================================================================
// Types
// ============================================================================

export interface SendMessageInput {
  text: string
  recipientId: string
  recipientUsername?: string
}

// ============================================================================
// Composable
// ============================================================================

export function useEncryptedChat(recipientId: string, messageLimit = 100) {
  const { isInitialized, initializeEncryption } = useEncryption()

  // State
  const messages = ref<DecryptedMessage[]>([])
  const loading = ref(true)
  const error = ref<string | null>(null)
  const conversationId = ref<string | null>(null)

  // Cache for already decrypted messages to avoid re-decryption
  const decryptedCache = new Map<string, DecryptedMessage>()

  // Current user
  const currentUser = computed(() => auth.currentUser)

  // Unsubscribe handle
  let unsubscribe: (() => void) | null = null

  // ============================================================================
  // Initialization
  // ============================================================================

  async function initialize() {
    const user = auth.currentUser
    if (!user) {
      error.value = 'Must be authenticated'
      loading.value = false
      return
    }

    try {
      // Initialize encryption if needed
      if (!isInitialized.value) {
        await initializeEncryption()
      }

      // Create conversation ID
      conversationId.value = createConversationId(user.uid, recipientId)

      // Ensure conversation document exists
      await ensureConversationExists(conversationId.value, user.uid, recipientId)

      // Subscribe to messages
      subscribeToMessages()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Initialization failed'
      loading.value = false
    }
  }

  // ============================================================================
  // Conversation Management
  // ============================================================================

  async function ensureConversationExists(
    convId: string,
    oderId1: string,
    oderId2: string
  ): Promise<void> {
    const docRef = doc(db, 'conversations', convId)
    const snapshot = await getDoc(docRef)

    if (!snapshot.exists()) {
      const meta: ConversationMeta = {
        id: convId,
        participants: [oderId1, oderId2].sort(),
        createdAt: Date.now(),
        lastMessageAt: Date.now(),
      }
      await setDoc(docRef, meta)
    }
  }

  // ============================================================================
  // Message Subscription
  // ============================================================================

  function subscribeToMessages() {
    if (!conversationId.value) return

    const messagesRef = collection(db, 'conversations', conversationId.value, 'messages')
    const q = query(
      messagesRef,
      orderBy('createdAt', 'asc'),
      limit(messageLimit)
    )

    unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const decryptedMessages: DecryptedMessage[] = []

        for (const docSnap of snapshot.docs) {
          const msgId = docSnap.id

          // Check if we already have this message decrypted in cache
          if (decryptedCache.has(msgId)) {
            decryptedMessages.push(decryptedCache.get(msgId)!)
            continue
          }

          // New message - decrypt it
          const data = docSnap.data() as EncryptedMessage
          try {
            // Skip replay check - we use cache to prevent re-processing
            const content = await decryptMessageSafe(data, true)
            const decrypted: DecryptedMessage = {
              id: msgId,
              senderId: data.senderId,
              recipientId: data.recipientId,
              senderUsername: data.senderUsername,
              conversationId: data.conversationId,
              createdAt: data.createdAt,
              text: content.text,
            }
            // Cache the decrypted message
            decryptedCache.set(msgId, decrypted)
            decryptedMessages.push(decrypted)
          } catch (e) {
            // Still add message but mark as failed
            const failed: DecryptedMessage = {
              id: msgId,
              senderId: data.senderId,
              recipientId: data.recipientId,
              senderUsername: data.senderUsername,
              conversationId: data.conversationId,
              createdAt: data.createdAt,
              decryptionFailed: true,
            }
            decryptedCache.set(msgId, failed)
            decryptedMessages.push(failed)
          }
        }

        messages.value = decryptedMessages
        loading.value = false
      },
      (err) => {
        console.error('Message subscription error:', err)
        error.value = 'Failed to load messages'
        loading.value = false
      }
    )
  }

  /**
   * Safely decrypt a message, handling errors
   * @param skipReplayCheck - Skip replay protection for historical messages
   */
  async function decryptMessageSafe(
    msg: EncryptedMessage,
    skipReplayCheck = false
  ): Promise<{ text?: string }> {
    const user = auth.currentUser
    if (!user) throw new Error('Not authenticated')

    // Determine who to use for key derivation
    // If I sent it, derive key with recipient
    // If I received it, derive key with sender
    const partnerId = msg.senderId === user.uid ? msg.recipientId : msg.senderId

    return await decryptMessage(partnerId, msg.encrypted, msg.messageNonce, skipReplayCheck)
  }

  // ============================================================================
  // Send Message
  // ============================================================================

  async function sendMessage(text: string, senderUsername: string): Promise<void> {
    const user = auth.currentUser
    if (!user) throw new Error('Not authenticated')
    if (!conversationId.value) throw new Error('Conversation not initialized')

    const trimmedText = text.trim()
    if (!trimmedText) return

    error.value = null

    try {
      // Encrypt message
      const { encrypted, messageNonce } = await encryptMessage(recipientId, {
        text: trimmedText,
      })

      // Create message document
      const messageData: Omit<EncryptedMessage, 'id'> = {
        senderId: user.uid,
        recipientId,
        senderUsername,
        conversationId: conversationId.value,
        createdAt: Date.now(),
        encrypted,
        messageNonce,
      }

      // Save to Firestore
      const messagesRef = collection(db, 'conversations', conversationId.value, 'messages')
      await addDoc(messagesRef, messageData)

      // Update conversation's lastMessageAt
      const convRef = doc(db, 'conversations', conversationId.value)
      await setDoc(convRef, { lastMessageAt: Date.now() }, { merge: true })
    } catch (e) {
      console.error('Send message error:', e)
      error.value = 'Failed to send message'
      throw e
    }
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  // Initialize when component mounts
  initialize()

  // Cleanup on unmount
  onUnmounted(() => {
    if (unsubscribe) {
      unsubscribe()
    }
  })

  // ============================================================================
  // Return
  // ============================================================================

  return {
    messages,
    loading,
    error,
    conversationId,
    sendMessage,
  }
}

export default useEncryptedChat
