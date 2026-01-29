/**
 * End-to-End Encryption Types
 *
 * Security Model:
 * - ECDH (P-256) for key exchange
 * - HKDF-SHA256 for key derivation
 * - AES-256-GCM for message encryption
 */

export interface EncryptedPayload {
  ciphertext: string    // Base64 encoded
  iv: string            // Base64 encoded 12-byte nonce
  version: number       // Protocol version
}

export interface EncryptedMessage {
  id: string
  senderId: string
  recipientId: string
  senderUsername: string
  conversationId: string
  createdAt: number
  encrypted: EncryptedPayload
  messageNonce: string  // Replay protection
}

export interface DecryptedMessage {
  id: string
  senderId: string
  recipientId: string
  senderUsername: string
  conversationId: string
  createdAt: number
  text?: string
  decryptionFailed?: boolean
}

export interface PublicKeyDocument {
  userId: string
  publicKey: string     // Base64 SPKI format
  displayName?: string  // User's display name
  createdAt: number
}

export interface ConversationMeta {
  id: string
  participants: string[]
  createdAt: number
  lastMessageAt: number
}

export interface KeyPairExport {
  publicKey: string
  privateKey: string
}

export const CRYPTO_CONFIG = {
  VERSION: 1,
  IV_LENGTH: 12,
  KEY_LENGTH: 256,
} as const

export class CryptoError extends Error {
  constructor(message: string, public code: string) {
    super(message)
    this.name = 'CryptoError'
  }
}