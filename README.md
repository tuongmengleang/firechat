# FireChat E2EE - Secure Real-Time Chat

A modern, end-to-end encrypted chat application built with **Vue 3**, **TypeScript**, **Tailwind CSS**, and **Firebase**.

## Features

- **End-to-End Encryption (E2EE):** Messages are encrypted on your device before sending. Only you and your chat partner can read them.
- **Real-Time Sync:** Instant messaging powered by Firebase Firestore snapshots.
- **Zero-Knowledge:** Firebase stores only encrypted payloads - the server cannot read your messages.
- **Modern Cryptography:** ECDH key exchange, HKDF key derivation, AES-256-GCM encryption.
- **One-to-One Chat:** Private encrypted conversations between two users.
- **Vue 3 Composition API:** Efficient state management using `<script setup>` and reactive primitives.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vue.js 3 + TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS |
| Backend | Firebase (Firestore & Auth) |
| Cryptography | Web Crypto API |

## How E2EE Works

### Overview

```
┌─────────────┐                              ┌─────────────┐
│   Alice     │                              │    Bob      │
│  (Browser)  │                              │  (Browser)  │
└──────┬──────┘                              └──────┬──────┘
       │                                            │
       │  1. Generate ECDH Key Pair                 │  1. Generate ECDH Key Pair
       │     (Private + Public)                     │     (Private + Public)
       │                                            │
       │  2. Publish Public Key ──────────────────► │  2. Publish Public Key
       │                         to Firebase        │
       │                                            │
       │  3. Fetch Bob's Public Key ◄────────────── │  3. Fetch Alice's Public Key
       │                                            │
       │  4. Derive Shared Secret                   │  4. Derive Shared Secret
       │     (Alice Private + Bob Public)           │     (Bob Private + Alice Public)
       │     = SAME KEY                             │     = SAME KEY
       │                                            │
       │  5. Encrypt Message ──────────────────────►│  5. Decrypt Message
       │     with AES-256-GCM      (ciphertext)     │     with AES-256-GCM
       │                                            │
       └────────────────────────────────────────────┘
```

### Step-by-Step Flow

#### 1. Key Generation (First Login)

When a user logs in for the first time:

```
User Device
    │
    ├─► Generate ECDH Key Pair (P-256 curve)
    │   ├─► Private Key → Stored in IndexedDB (never leaves device)
    │   └─► Public Key → Published to Firestore
    │
    └─► Ready to chat
```

#### 2. Starting a Conversation

When Alice wants to chat with Bob:

```
Alice's Device
    │
    ├─► Fetch Bob's public key from Firestore
    │
    ├─► ECDH Key Agreement:
    │       Alice's Private Key + Bob's Public Key
    │                     ↓
    │              Shared Secret (256 bits)
    │                     ↓
    │       HKDF with conversation context
    │                     ↓
    │         AES-256 Conversation Key
    │
    └─► Key cached in memory for this conversation
```

**Note:** Bob derives the SAME key using his private key + Alice's public key. This is the magic of ECDH!

#### 3. Sending a Message

```
Alice types "Hello Bob!"
    │
    ├─► Generate random IV (12 bytes)
    ├─► Generate message nonce (24 bytes)
    │
    ├─► Encrypt with AES-256-GCM:
    │       plaintext = { text: "Hello Bob!", _nonce: "..." }
    │       ciphertext = AES-GCM(plaintext, key, iv)
    │
    ├─► Store in Firestore:
    │       {
    │         senderId: "alice_uid",
    │         recipientId: "bob_uid",
    │         encrypted: { ciphertext, iv, version },
    │         messageNonce: "...",
    │         createdAt: timestamp
    │       }
    │
    └─► Bob receives via Firestore real-time listener
```

#### 4. Receiving a Message

```
Bob receives encrypted message
    │
    ├─► Derive conversation key (if not cached):
    │       Bob's Private Key + Alice's Public Key → Same shared key
    │
    ├─► Decrypt with AES-256-GCM:
    │       plaintext = decrypt(ciphertext, key, iv)
    │       content = JSON.parse(plaintext)
    │
    ├─► Verify nonce matches (integrity check)
    │
    └─► Display: "Hello Bob!"
```

### Cryptographic Algorithms

| Purpose | Algorithm | Why |
|---------|-----------|-----|
| Key Exchange | ECDH P-256 | Web Crypto native, 128-bit security |
| Key Derivation | HKDF-SHA256 | Standard KDF, prevents related-key attacks |
| Encryption | AES-256-GCM | Authenticated encryption, hardware accelerated |
| Auth Tag | 128-bit GCM | Detects tampering |

### Security Properties

| Property | How It's Achieved |
|----------|-------------------|
| **Confidentiality** | AES-256-GCM encryption |
| **Integrity** | GCM authentication tag |
| **Authentication** | ECDH with user's identity key |
| **Forward Secrecy** | Unique key per conversation |

### What Firebase Sees

| Data | Visible to Firebase? |
|------|---------------------|
| Who is chatting | Yes (metadata) |
| When messages sent | Yes (timestamps) |
| Message content | **NO** (encrypted) |
| Encryption keys | **NO** (never uploaded) |

## Installation & Setup

### 1. Clone the repository

```bash
git clone git@github.com:tuongmengleang/firechat.git
cd firechat
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure Firebase

Create a `.env` file:

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

### 4. Enable Firebase Authentication

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project → Authentication → Sign-in method
3. Enable **Anonymous** authentication

### 5. Deploy Firestore Security Rules

Copy the contents of `firestore.rules` to:
Firebase Console → Firestore Database → Rules → Publish

### 6. Run the app

```bash
pnpm dev
```

Open http://localhost:3000

## Testing E2EE

1. Open app in **Browser 1** → Login as "Alice"
2. Open app in **Browser 2** (incognito) → Login as "Bob"
3. Alice clicks on Bob in the conversation list
4. Send messages back and forth
5. Check Firestore → You'll only see encrypted ciphertext!

## Project Structure

```
src/
├── components/
│   ├── EncryptedApp.vue        # Main app container
│   ├── LoginView.vue           # Authentication UI
│   ├── ConversationList.vue    # User list
│   └── EncryptedChatView.vue   # Chat interface
├── composables/
│   ├── useAuth.ts              # Firebase authentication
│   ├── useEncryption.ts        # E2EE key management
│   ├── useEncryptedChat.ts     # Encrypted messaging
│   └── useUsers.ts             # User discovery
├── services/
│   ├── crypto.ts               # Cryptographic operations
│   └── keyStorage.ts           # IndexedDB key storage
├── types/
│   └── encryption.ts           # TypeScript types
└── config/
    └── firebase.ts             # Firebase configuration
```

## Limitations & Future Improvements

| Current Limitation | Future Solution |
|-------------------|-----------------|
| No Perfect Forward Secrecy | Implement Double Ratchet (Signal Protocol) |
| Single device only | Secure key backup/sync |
| No key verification | Safety numbers / QR codes |
| Anonymous auth only | Add email/OAuth providers |

## Security Considerations

- **Private keys never leave your device** - stored only in IndexedDB
- **Each conversation has a unique derived key** - compromise of one doesn't affect others
- **Messages are immutable** - cannot be edited or deleted (by design)
- **Metadata is visible** - Firebase knows who chats with whom, when

## License

MIT

---

For detailed architecture documentation, see [E2EE_ARCHITECTURE.md](./E2EE_ARCHITECTURE.md)
