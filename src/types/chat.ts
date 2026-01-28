import type { Timestamp } from 'firebase/firestore'

export type FileType = 'image' | 'video'

export interface FileAttachment {
  url: string
  type: FileType
  name: string
  size: number
  mimeType: string
}

export interface VoiceAttachment {
  url: string
  duration: number
  waveform: number[]
  mimeType: string
  size: number
}

export interface FilePreview {
  file: File
  url: string
  type: FileType
  name: string
  size: number
}

export interface ImagePreview {
  id: string
  file: File
  url: string
  name: string
  size: number
  status: 'pending' | 'uploading' | 'completed' | 'error'
  progress: number
  error?: string
}

export interface UploadState {
  isUploading: boolean
  progress: number
  error: string | null
}

export interface MultipleUploadState {
  isUploading: boolean
  totalProgress: number
  completedCount: number
  totalCount: number
  error: string | null
}

export interface Message {
  id: string
  text?: string
  username: string
  createdAt: Timestamp
  file?: FileAttachment
  files?: FileAttachment[]
  voice?: VoiceAttachment
}

export interface MessageInput {
  text?: string
  username: string
  file?: FileAttachment
  files?: FileAttachment[]
  voice?: VoiceAttachment
}

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm']
export const ALLOWED_AUDIO_TYPES = ['audio/wav', 'audio/webm', 'audio/mp4', 'audio/ogg']
export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
export const MAX_IMAGES_PER_MESSAGE = 10 // Maximum images per batch send
export const MAX_VOICE_DURATION = 300 // 5 minutes in seconds
export const WAVEFORM_SAMPLES = 50 // Number of samples for waveform visualization

// Typing indicator types
export interface TypingUser {
  username: string
  lastTypingAt: number // timestamp in ms
}

export const TYPING_TIMEOUT = 3000 // ms before typing status expires
export const TYPING_THROTTLE = 1000 // ms between typing broadcasts
