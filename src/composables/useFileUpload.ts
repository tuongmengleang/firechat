import { ref } from 'vue'
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  type UploadTask,
} from 'firebase/storage'
import { storage } from '@/config/firebase'
import type { FileAttachment, FilePreview, UploadState, FileType } from '@/types/chat'
import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  MAX_FILE_SIZE,
} from '@/types/chat'

export function useFileUpload(roomId: string = 'general') {
  const filePreview = ref<FilePreview | null>(null)
  const uploadState = ref<UploadState>({
    isUploading: false,
    progress: 0,
    error: null,
  })

  let currentUploadTask: UploadTask | null = null

  const getFileType = (mimeType: string): FileType | null => {
    if (ALLOWED_IMAGE_TYPES.includes(mimeType)) return 'image'
    if (ALLOWED_VIDEO_TYPES.includes(mimeType)) return 'video'
    return null
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const selectFile = (file: File): boolean => {
    uploadState.value.error = null

    const fileType = getFileType(file.type)
    if (!fileType) {
      uploadState.value.error = 'Unsupported file type. Use JPEG, PNG, GIF, WebP, MP4, or WebM.'
      return false
    }

    if (file.size > MAX_FILE_SIZE) {
      uploadState.value.error = `File too large. Maximum size is ${formatFileSize(MAX_FILE_SIZE)}.`
      return false
    }

    const previewUrl = URL.createObjectURL(file)
    filePreview.value = {
      file,
      url: previewUrl,
      type: fileType,
      name: file.name,
      size: file.size,
    }

    return true
  }

  const clearFile = (): void => {
    if (filePreview.value?.url) {
      URL.revokeObjectURL(filePreview.value.url)
    }
    filePreview.value = null
    uploadState.value.error = null
  }

  const cancelUpload = (): void => {
    if (currentUploadTask) {
      currentUploadTask.cancel()
      currentUploadTask = null
    }
    uploadState.value = {
      isUploading: false,
      progress: 0,
      error: null,
    }
  }

  const uploadFile = async (username: string): Promise<FileAttachment | null> => {
    if (!filePreview.value) return null

    const { file, type } = filePreview.value
    const timestamp = Date.now()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filePath = `chatRooms/${roomId}/${username}/${timestamp}_${sanitizedName}`
    const fileRef = storageRef(storage, filePath)

    uploadState.value = {
      isUploading: true,
      progress: 0,
      error: null,
    }

    return new Promise((resolve, reject) => {
      currentUploadTask = uploadBytesResumable(fileRef, file)

      currentUploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          uploadState.value.progress = Math.round(progress)
        },
        (error) => {
          currentUploadTask = null
          uploadState.value.isUploading = false

          if (error.code === 'storage/canceled') {
            uploadState.value.error = 'Upload canceled'
            resolve(null)
          } else {
            uploadState.value.error = 'Upload failed. Please try again.'
            reject(error)
          }
        },
        async () => {
          try {
            const downloadUrl = await getDownloadURL(currentUploadTask!.snapshot.ref)
            currentUploadTask = null

            const attachment: FileAttachment = {
              url: downloadUrl,
              type,
              name: file.name,
              size: file.size,
              mimeType: file.type,
            }

            uploadState.value = {
              isUploading: false,
              progress: 100,
              error: null,
            }

            clearFile()
            resolve(attachment)
          } catch (error) {
            uploadState.value = {
              isUploading: false,
              progress: 0,
              error: 'Failed to get download URL',
            }
            reject(error)
          }
        }
      )
    })
  }

  return {
    filePreview,
    uploadState,
    selectFile,
    clearFile,
    cancelUpload,
    uploadFile,
    formatFileSize,
  }
}
