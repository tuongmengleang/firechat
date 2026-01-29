/**
 * E2EE Composable
 *
 * Manages encryption keys and provides encrypt/decrypt operations
 * for the chat application.
 *
 * Key Flow:
 * 1. On first use, generate ECDH key pair
 * 2. Publish public key to Firestore (users/{uid}/publicKey)
 * 3. When starting conversation, fetch recipient's public key
 * 4. Derive shared AES-256 key via ECDH + HKDF
 * 5. Use derived key for all messages in that conversation
 */

import { ref, computed } from 'vue'
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore'
import { db, auth } from '@/config/firebase'
import type { EncryptedPayload, DecryptedMessage } from '@/types/encryption'
import {
  generateKeyPair,
  exportKeyPair,
  importPublicKey,
  importPrivateKey,
  deriveConversationKey,
  encryptObject,
  decryptObject,
  generateNonce,
  validateNonce,
  createConversationId as _createConversationId,
  toBase64,
  fromBase64,
} from '@/services/crypto'

// Re-export for use by other modules
export const createConversationId = _createConversationId
import {
  saveIdentityKeys,
  getIdentityKeys,
  cacheConversationKey,
  getCachedConversationKey,
} from '@/services/keyStorage'

// ============================================================================
// State
// ============================================================================

const isInitialized = ref(false)
const isInitializing = ref(false)
const initError = ref<string | null>(null)

const myPrivateKey = ref<CryptoKey | null>(null)
const myPublicKey = ref<CryptoKey | null>(null)
const myPublicKeyBase64 = ref<string | null>(null)

// Cache of derived conversation keys: recipientId -> CryptoKey
const conversationKeys = new Map<string, CryptoKey>()

// Cache of recipient public keys: oderId -> CryptoKey
const publicKeyCache = new Map<string, CryptoKey>()

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize E2EE for the current user
 * Must be called after Firebase Auth login
 */
export async function initializeEncryption(): Promise<void> {
  const user = auth.currentUser
  if (!user) {
    throw new Error('Must be authenticated to initialize encryption')
  }

  if (isInitialized.value || isInitializing.value) return

  isInitializing.value = true
  initError.value = null

  try {
    // Try to load existing keys from IndexedDB
    const stored = await getIdentityKeys(user.uid)

    if (stored) {
      // Import existing keys
      myPrivateKey.value = await importPrivateKey(stored.privateKey)
      myPublicKey.value = await importPublicKey(stored.publicKey)
      myPublicKeyBase64.value = stored.publicKey
    } else {
      // Generate new key pair
      const keyPair = await generateKeyPair()
      const exported = await exportKeyPair(keyPair)

      myPrivateKey.value = keyPair.privateKey
      myPublicKey.value = keyPair.publicKey
      myPublicKeyBase64.value = exported.publicKey

      // Save to IndexedDB
      await saveIdentityKeys(user.uid, exported)

      // Publish public key to Firestore
      await publishPublicKey(user.uid, exported.publicKey, user.displayName || undefined)
    }

    // Ensure public key is in Firestore
    await ensurePublicKeyPublished(user.uid, user.displayName || undefined)

    isInitialized.value = true
  } catch (e) {
    initError.value = e instanceof Error ? e.message : 'Initialization failed'
    throw e
  } finally {
    isInitializing.value = false
  }
}

/**
 * Publish public key to Firestore
 */
async function publishPublicKey(userId: string, publicKey: string, displayName?: string): Promise<void> {
  const docRef = doc(db, 'publicKeys', userId)
  await setDoc(docRef, {
    userId,
    publicKey,
    displayName: displayName || 'Anonymous',
    createdAt: Date.now(),
  }, { merge: true })
}

/**
 * Ensure public key is published (handles refresh/re-login)
 */
async function ensurePublicKeyPublished(userId: string, displayName?: string): Promise<void> {
  const docRef = doc(db, 'publicKeys', userId)
  const snapshot = await getDoc(docRef)

  if (!snapshot.exists() && myPublicKeyBase64.value) {
    await publishPublicKey(userId, myPublicKeyBase64.value, displayName)
  } else if (snapshot.exists() && displayName) {
    // Update display name if changed
    const data = snapshot.data()
    if (data.displayName !== displayName) {
      await setDoc(docRef, { displayName }, { merge: true })
    }
  }
}

// ============================================================================
// Key Exchange
// ============================================================================

/**
 * Get recipient's public key from Firestore
 */
export async function getRecipientPublicKey(recipientId: string): Promise<CryptoKey> {
  // Check cache first
  const cached = publicKeyCache.get(recipientId)
  if (cached) return cached

  // Fetch from Firestore
  const docRef = doc(db, 'publicKeys', recipientId)
  const snapshot = await getDoc(docRef)

  if (!snapshot.exists()) {
    throw new Error(`Public key not found for user: ${recipientId}`)
  }

  const data = snapshot.data()
  const publicKey = await importPublicKey(data.publicKey)

  // Cache it
  publicKeyCache.set(recipientId, publicKey)

  return publicKey
}

/**
 * Get or derive conversation key for a recipient
 */
export async function getConversationKey(recipientId: string): Promise<CryptoKey> {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')
  if (!myPrivateKey.value) throw new Error('Encryption not initialized')

  // Check memory cache
  const cached = conversationKeys.get(recipientId)
  if (cached) return cached

  // Get recipient's public key
  const recipientPublicKey = await getRecipientPublicKey(recipientId)

  // Derive conversation key
  const conversationId = _createConversationId(user.uid, recipientId)
  const key = await deriveConversationKey(
    myPrivateKey.value,
    recipientPublicKey,
    conversationId
  )

  // Cache in memory
  conversationKeys.set(recipientId, key)

  return key
}

// ============================================================================
// Message Encryption/Decryption
// ============================================================================

export interface MessageContent {
  text?: string
  // Future: file, voice, etc.
}

export interface EncryptedMessageData {
  encrypted: EncryptedPayload
  messageNonce: string
}

/**
 * Encrypt a message for a recipient
 */
export async function encryptMessage(
  recipientId: string,
  content: MessageContent
): Promise<EncryptedMessageData> {
  const key = await getConversationKey(recipientId)
  const nonce = generateNonce()

  // Include nonce in encrypted content for integrity verification
  const payload = { ...content, _nonce: nonce }
  const encrypted = await encryptObject(payload, key)

  return { encrypted, messageNonce: nonce }
}

/**
 * Decrypt a message from a sender
 * @param skipReplayCheck - Set to true when loading historical messages
 */
export async function decryptMessage(
  senderId: string,
  encrypted: EncryptedPayload,
  messageNonce: string,
  skipReplayCheck = false
): Promise<MessageContent> {
  const key = await getConversationKey(senderId)

  const decrypted = await decryptObject<MessageContent & { _nonce: string }>(
    encrypted,
    key
  )

  // Verify nonce matches (integrity check - always performed)
  if (decrypted._nonce !== messageNonce) {
    throw new Error('Message nonce mismatch - possible tampering')
  }

  // Validate nonce hasn't been seen (replay protection)
  // Skip for historical messages, only check for real-time incoming
  if (!skipReplayCheck && !validateNonce(messageNonce)) {
    throw new Error('Duplicate nonce - possible replay attack')
  }

  // Remove internal nonce from result
  const { _nonce, ...content } = decrypted
  return content
}

// ============================================================================
// Composable Export
// ============================================================================

export function useEncryption() {
  return {
    // State
    isInitialized: computed(() => isInitialized.value),
    isInitializing: computed(() => isInitializing.value),
    initError: computed(() => initError.value),
    myPublicKey: computed(() => myPublicKeyBase64.value),

    // Methods
    initializeEncryption,
    getRecipientPublicKey,
    getConversationKey,
    encryptMessage,
    decryptMessage,

    // Utilities
    createConversationId: _createConversationId,
  }
}

export default useEncryption
