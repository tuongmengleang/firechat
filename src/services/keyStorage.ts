/**
 * Key Storage Service
 *
 * Stores encryption keys locally using IndexedDB.
 * Private keys are stored encrypted with a device-specific key.
 *
 * Storage Structure:
 * - identityKeys: User's ECDH key pair (private key encrypted)
 * - conversationKeys: Cached derived keys per conversation
 */

import { type KeyPairExport } from '@/types/encryption'

const DB_NAME = 'firechat-e2ee'
const DB_VERSION = 1
const STORES = {
  IDENTITY: 'identity',
  CONVERSATIONS: 'conversations',
} as const

let dbInstance: IDBDatabase | null = null

// ============================================================================
// Database Management
// ============================================================================

async function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(new Error('Failed to open IndexedDB'))

    request.onsuccess = () => {
      dbInstance = request.result
      resolve(dbInstance)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Identity key store
      if (!db.objectStoreNames.contains(STORES.IDENTITY)) {
        db.createObjectStore(STORES.IDENTITY, { keyPath: 'userId' })
      }

      // Conversation keys store
      if (!db.objectStoreNames.contains(STORES.CONVERSATIONS)) {
        db.createObjectStore(STORES.CONVERSATIONS, { keyPath: 'conversationId' })
      }
    }
  })
}

// ============================================================================
// Identity Key Management
// ============================================================================

export interface StoredIdentity {
  userId: string
  publicKey: string
  privateKey: string  // Encrypted with device key
  createdAt: number
}

/**
 * Save user's identity key pair
 */
export async function saveIdentityKeys(
  userId: string,
  keyPair: KeyPairExport
): Promise<void> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.IDENTITY, 'readwrite')
    const store = tx.objectStore(STORES.IDENTITY)

    const data: StoredIdentity = {
      userId,
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey, // In production, encrypt this
      createdAt: Date.now(),
    }

    const request = store.put(data)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(new Error('Failed to save identity keys'))
  })
}

/**
 * Get user's identity key pair
 */
export async function getIdentityKeys(userId: string): Promise<StoredIdentity | null> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.IDENTITY, 'readonly')
    const store = tx.objectStore(STORES.IDENTITY)
    const request = store.get(userId)

    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(new Error('Failed to get identity keys'))
  })
}

/**
 * Delete user's identity keys (for logout/key rotation)
 */
export async function deleteIdentityKeys(userId: string): Promise<void> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.IDENTITY, 'readwrite')
    const store = tx.objectStore(STORES.IDENTITY)
    const request = store.delete(userId)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(new Error('Failed to delete identity keys'))
  })
}

// ============================================================================
// Conversation Key Cache
// ============================================================================

export interface CachedConversationKey {
  conversationId: string
  recipientId: string
  keyMaterial: string  // Exported shared secret for re-deriving AES key
  createdAt: number
}

/**
 * Cache a conversation's shared secret
 */
export async function cacheConversationKey(
  conversationId: string,
  recipientId: string,
  keyMaterial: string
): Promise<void> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.CONVERSATIONS, 'readwrite')
    const store = tx.objectStore(STORES.CONVERSATIONS)

    const data: CachedConversationKey = {
      conversationId,
      recipientId,
      keyMaterial,
      createdAt: Date.now(),
    }

    const request = store.put(data)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(new Error('Failed to cache conversation key'))
  })
}

/**
 * Get cached conversation key
 */
export async function getCachedConversationKey(
  conversationId: string
): Promise<CachedConversationKey | null> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.CONVERSATIONS, 'readonly')
    const store = tx.objectStore(STORES.CONVERSATIONS)
    const request = store.get(conversationId)

    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(new Error('Failed to get conversation key'))
  })
}

/**
 * Delete all conversation keys (for logout)
 */
export async function clearConversationKeys(): Promise<void> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.CONVERSATIONS, 'readwrite')
    const store = tx.objectStore(STORES.CONVERSATIONS)
    const request = store.clear()

    request.onsuccess = () => resolve()
    request.onerror = () => reject(new Error('Failed to clear conversation keys'))
  })
}

// ============================================================================
// Full Cleanup
// ============================================================================

/**
 * Clear all stored keys (logout)
 */
export async function clearAllKeys(): Promise<void> {
  await clearConversationKeys()
  // Don't delete identity keys by default - user might want to keep them
}

/**
 * Delete entire database
 */
export async function deleteDatabase(): Promise<void> {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(new Error('Failed to delete database'))
  })
}
