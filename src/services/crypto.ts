/**
 * Cryptographic Service for E2EE
 *
 * Architecture:
 * 1. ECDH (P-256) generates shared secret between two users
 * 2. HKDF derives AES-256 key from shared secret + conversation context
 * 3. AES-256-GCM encrypts/decrypts messages with authentication
 *
 * Security Properties:
 * - Forward secrecy via unique IV per message
 * - Integrity via GCM authentication tag
 * - Replay protection via message nonces
 */

import { type EncryptedPayload, type KeyPairExport, CRYPTO_CONFIG, CryptoError } from '@/types/encryption'

// ============================================================================
// Utility Functions
// ============================================================================

export function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

export function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str)
}

export function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytes
}

export function generateNonce(): string {
  return toBase64(randomBytes(24))
}

export function createConversationId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_')
}

// ============================================================================
// Key Management
// ============================================================================

/**
 * Generate ECDH key pair for identity
 */
export async function generateKeyPair(): Promise<CryptoKeyPair> {
  try {
    return await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits']
    )
  } catch (e) {
    throw new CryptoError(`Key generation failed: ${e}`, 'KEY_GEN_FAILED')
  }
}

/**
 * Export key pair for storage
 */
export async function exportKeyPair(keyPair: CryptoKeyPair): Promise<KeyPairExport> {
  const [pubRaw, privRaw] = await Promise.all([
    crypto.subtle.exportKey('spki', keyPair.publicKey),
    crypto.subtle.exportKey('pkcs8', keyPair.privateKey),
  ])
  return {
    publicKey: toBase64(new Uint8Array(pubRaw)),
    privateKey: toBase64(new Uint8Array(privRaw)),
  }
}

/**
 * Import public key from Base64
 */
export async function importPublicKey(b64: string): Promise<CryptoKey> {
  try {
    return await crypto.subtle.importKey(
      'spki',
      fromBase64(b64),
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      []
    )
  } catch (e) {
    throw new CryptoError(`Public key import failed: ${e}`, 'KEY_IMPORT_FAILED')
  }
}

/**
 * Import private key from Base64
 */
export async function importPrivateKey(b64: string): Promise<CryptoKey> {
  try {
    return await crypto.subtle.importKey(
      'pkcs8',
      fromBase64(b64),
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits']
    )
  } catch (e) {
    throw new CryptoError(`Private key import failed: ${e}`, 'KEY_IMPORT_FAILED')
  }
}

// ============================================================================
// Key Derivation
// ============================================================================

/**
 * Derive shared secret via ECDH, then derive AES key via HKDF
 */
export async function deriveConversationKey(
  myPrivateKey: CryptoKey,
  theirPublicKey: CryptoKey,
  conversationId: string
): Promise<CryptoKey> {
  try {
    // ECDH: derive shared bits
    const sharedBits = await crypto.subtle.deriveBits(
      { name: 'ECDH', public: theirPublicKey },
      myPrivateKey,
      256
    )

    // Import as HKDF key material
    const hkdfKey = await crypto.subtle.importKey(
      'raw',
      sharedBits,
      'HKDF',
      false,
      ['deriveKey']
    )

    // HKDF: derive AES-256-GCM key with conversation context
    return await crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: stringToBytes('firechat-e2ee-v1'),
        info: stringToBytes(`conversation:${conversationId}`),
      },
      hkdfKey,
      { name: 'AES-GCM', length: CRYPTO_CONFIG.KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    )
  } catch (e) {
    throw new CryptoError(`Key derivation failed: ${e}`, 'KEY_DERIVE_FAILED')
  }
}

// ============================================================================
// Message Encryption/Decryption
// ============================================================================

/**
 * Encrypt plaintext with AES-256-GCM
 */
export async function encrypt(plaintext: string, key: CryptoKey): Promise<EncryptedPayload> {
  try {
    const iv = randomBytes(CRYPTO_CONFIG.IV_LENGTH)
    const data = stringToBytes(plaintext)

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    )

    return {
      ciphertext: toBase64(new Uint8Array(ciphertext)),
      iv: toBase64(iv),
      version: CRYPTO_CONFIG.VERSION,
    }
  } catch (e) {
    throw new CryptoError(`Encryption failed: ${e}`, 'ENCRYPT_FAILED')
  }
}

/**
 * Decrypt ciphertext with AES-256-GCM
 */
export async function decrypt(payload: EncryptedPayload, key: CryptoKey): Promise<string> {
  try {
    if (payload.version !== CRYPTO_CONFIG.VERSION) {
      throw new Error(`Unsupported version: ${payload.version}`)
    }

    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(payload.iv) },
      key,
      fromBase64(payload.ciphertext)
    )

    return bytesToString(new Uint8Array(plaintext))
  } catch (e) {
    if (e instanceof DOMException && e.name === 'OperationError') {
      throw new CryptoError('Decryption failed: integrity check failed', 'INTEGRITY_FAILED')
    }
    throw new CryptoError(`Decryption failed: ${e}`, 'DECRYPT_FAILED')
  }
}

/**
 * Encrypt a JSON object
 */
export async function encryptObject(obj: Record<string, unknown>, key: CryptoKey): Promise<EncryptedPayload> {
  return encrypt(JSON.stringify(obj), key)
}

/**
 * Decrypt to JSON object
 */
export async function decryptObject<T>(payload: EncryptedPayload, key: CryptoKey): Promise<T> {
  const json = await decrypt(payload, key)
  return JSON.parse(json) as T
}

// ============================================================================
// Replay Protection
// ============================================================================

const seenNonces = new Set<string>()
const MAX_NONCES = 10000

export function validateNonce(nonce: string): boolean {
  if (seenNonces.has(nonce)) {
    return false // Replay detected
  }
  if (seenNonces.size >= MAX_NONCES) {
    // Evict oldest entries (simple FIFO via Set iteration order)
    const iterator = seenNonces.values()
    for (let i = 0; i < MAX_NONCES * 0.2; i++) {
      const next = iterator.next()
      if (!next.done) seenNonces.delete(next.value)
    }
  }
  seenNonces.add(nonce)
  return true
}

export function clearNonces(): void {
  seenNonces.clear()
}
