# End-to-End Encryption Architecture

## Overview

This document describes the end-to-end encryption (E2EE) implementation for FireChat, a Vue 3 + Firebase chat application. The system ensures that **only the sender and recipient can read message content** - Firebase, network operators, and any third parties cannot decrypt messages.

## Security Model

### Trust Model

```
┌─────────────────────────────────────────────────────────────────┐
│                         TRUSTED                                  │
│  ┌──────────┐                               ┌──────────┐        │
│  │  User A  │                               │  User B  │        │
│  │ (Client) │                               │ (Client) │        │
│  └────┬─────┘                               └────┬─────┘        │
│       │                                          │              │
│       │  Private keys stored locally             │              │
│       │  Encryption/decryption happens here      │              │
└───────┼──────────────────────────────────────────┼──────────────┘
        │                                          │
        │          UNTRUSTED TRANSPORT             │
        ▼                                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                         UNTRUSTED                                │
│                                                                  │
│    ┌─────────────────────────────────────────────────────┐      │
│    │                    Firebase                          │      │
│    │                                                      │      │
│    │   - Stores only encrypted message payloads          │      │
│    │   - Stores public keys (not private)                │      │
│    │   - Cannot decrypt any message content              │      │
│    │   - Handles authentication & routing only           │      │
│    │                                                      │      │
│    └─────────────────────────────────────────────────────┘      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### What Is Protected

| Data | Protection |
|------|------------|
| Message text | Encrypted (AES-256-GCM) |
| Message nonce | Encrypted within payload |
| Private keys | Never leave device |
| Conversation keys | Derived locally, never transmitted |

### What Is NOT Protected (Metadata)

| Data | Why |
|------|-----|
| Sender ID | Needed for routing & display |
| Recipient ID | Needed for routing |
| Timestamp | Needed for ordering |
| Message existence | Firebase knows a message was sent |
| Conversation participants | Needed for access control |

## Cryptographic Primitives

### Algorithms Used

| Purpose | Algorithm | Security Level |
|---------|-----------|----------------|
| Key Exchange | ECDH (P-256) | 128-bit equivalent |
| Key Derivation | HKDF-SHA256 | 256-bit |
| Message Encryption | AES-256-GCM | 256-bit |
| Authentication | GCM Auth Tag | 128-bit |

### Why These Choices

1. **ECDH P-256**: Web Crypto API native support, widely trusted, efficient
2. **HKDF**: Standard key derivation function, prevents related-key attacks
3. **AES-256-GCM**: Authenticated encryption, prevents tampering, fast in hardware

## Key Flow

### 1. User Registration / First Login

```
User A Device
│
├─► Generate ECDH Key Pair (P-256)
│   ├─► Private Key → IndexedDB (local only)
│   └─► Public Key → Firestore (publicKeys/{uid})
│
└─► Ready for conversations
```

### 2. Starting a Conversation

```
User A wants to chat with User B
│
├─► Fetch User B's public key from Firestore
│
├─► ECDH Key Agreement:
│   │
│   │   A's Private Key + B's Public Key
│   │              ↓
│   │       Shared Secret (256 bits)
│   │              ↓
│   │   HKDF with conversation context
│   │              ↓
│   │     AES-256 Conversation Key
│   │
│   └─► (User B derives the SAME key using their private key + A's public key)
│
└─► Conversation key cached in memory
```

### 3. Sending a Message

```
User A sends "Hello!"
│
├─► Generate random IV (12 bytes)
├─► Generate message nonce (24 bytes)
│
├─► Encrypt:
│   │   plaintext = JSON({ text: "Hello!", _nonce: "..." })
│   │   ciphertext = AES-256-GCM(plaintext, key, iv)
│   │
│   └─► Encrypted payload:
│       {
│         ciphertext: "base64...",
│         iv: "base64...",
│         version: 1
│       }
│
├─► Store in Firestore:
│   conversations/{convId}/messages/{msgId}
│   {
│     senderId: "A",
│     recipientId: "B",
│     encrypted: { ... },
│     messageNonce: "...",
│     createdAt: timestamp
│   }
│
└─► User B receives via Firestore listener
```

### 4. Receiving a Message

```
User B receives encrypted message
│
├─► Derive conversation key (if not cached):
│   B's Private Key + A's Public Key → Same shared key
│
├─► Decrypt:
│   │   plaintext = AES-256-GCM.decrypt(ciphertext, key, iv)
│   │   content = JSON.parse(plaintext)
│   │
│   └─► Verify nonce matches messageNonce field
│
├─► Replay protection:
│   │   Check nonce not seen before
│   │   Mark nonce as seen
│   │
│   └─► Reject if duplicate (replay attack)
│
└─► Display decrypted message
```

## Firestore Schema

### Collections

```
/publicKeys/{userId}
  - oderId: string (Firebase UID)
  - publicKey: string (Base64 SPKI format)
  - createdAt: number

/conversations/{conversationId}
  - id: string (sorted UIDs: "uid1_uid2")
  - participants: string[] (two UIDs)
  - createdAt: number
  - lastMessageAt: number

/conversations/{conversationId}/messages/{messageId}
  - senderId: string
  - recipientId: string
  - senderUsername: string
  - conversationId: string
  - createdAt: number
  - encrypted: {
      ciphertext: string (Base64)
      iv: string (Base64, 12 bytes)
      version: number
    }
  - messageNonce: string (Base64, 24 bytes)
```

### Security Rules Summary

- Users can only write their own public key
- Users can only access conversations they're part of
- Messages validated for structure, NOT content
- Messages are immutable (no edit/delete)

## Security Properties

### Confidentiality
- Messages encrypted with AES-256-GCM before leaving device
- Only participants with correct private keys can decrypt
- Firebase stores only ciphertext

### Integrity
- GCM authentication tag detects any tampering
- Nonce embedded in encrypted content and verified
- Mismatched nonce = rejected message

### Replay Protection
- Unique nonce per message
- Client tracks seen nonces
- Duplicate nonce = rejected (replay attack)

### Forward Secrecy (Partial)
- Each conversation has a unique derived key
- Compromise of one conversation doesn't affect others
- **Limitation**: Same conversation key for all messages (see Limitations)

## Limitations & Future Improvements

### Current Limitations

1. **No Perfect Forward Secrecy (PFS)**
   - Same key used for all messages in a conversation
   - If key is compromised, all past messages are readable
   - **Mitigation**: Implement Double Ratchet (Signal Protocol)

2. **No Key Rotation**
   - Identity keys are long-lived
   - **Mitigation**: Implement periodic key rotation

3. **No Device Verification**
   - No verification that public keys match expected devices
   - Vulnerable to key substitution attacks
   - **Mitigation**: Implement safety numbers / QR code verification

4. **Metadata Visible**
   - Who talks to whom, when, how often
   - **Mitigation**: Use anonymous transport (beyond scope)

5. **No Multi-Device Support**
   - Private key on single device
   - **Mitigation**: Implement secure key backup/sync

6. **Local Key Storage**
   - Keys in IndexedDB (encrypted by browser)
   - Vulnerable if device is compromised
   - **Mitigation**: Use device secure enclave where available

### Recommended Improvements

| Priority | Improvement | Complexity |
|----------|-------------|------------|
| High | Double Ratchet for PFS | High |
| High | Safety number verification | Medium |
| Medium | Key rotation schedule | Medium |
| Medium | Multi-device sync | High |
| Low | Encrypted file attachments | Medium |

## File Structure

```
src/
├── types/
│   └── encryption.ts      # E2EE type definitions
│
├── services/
│   ├── crypto.ts          # Core cryptographic operations
│   └── keyStorage.ts      # IndexedDB key persistence
│
├── composables/
│   ├── useAuth.ts         # Firebase authentication
│   ├── useEncryption.ts   # E2EE key management
│   ├── useEncryptedChat.ts# Encrypted messaging
│   └── useUsers.ts        # User discovery
│
├── components/
│   ├── LoginView.vue      # Authentication UI
│   ├── ConversationList.vue# User/conversation selection
│   ├── EncryptedChatView.vue# Chat interface
│   └── EncryptedApp.vue   # Main app container
│
├── AppEncrypted.vue       # E2EE app entry point
└── main.ts                # App initialization
```

## Testing Recommendations

### Unit Tests
- Key generation produces valid keys
- Encryption/decryption roundtrip works
- Nonce validation catches replays
- Key derivation is deterministic

### Integration Tests
- Two clients can exchange messages
- Messages unreadable without correct keys
- Firestore rules enforce access control

### Security Tests
- Tampered ciphertext detected (GCM)
- Replay attacks detected
- Invalid keys rejected
- Rate limiting on key fetches

## References

- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [AES-GCM](https://en.wikipedia.org/wiki/Galois/Counter_Mode)
- [ECDH](https://en.wikipedia.org/wiki/Elliptic-curve_Diffie%E2%80%93Hellman)
- [HKDF](https://tools.ietf.org/html/rfc5869)
- [Signal Protocol](https://signal.org/docs/) (for future improvements)
