import { ref } from 'vue'
import { uploadToCloudinary, type UploadProgress } from '@/config/cloudinary'
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

  let abortController: AbortController | null = null
  let isCanceled = false

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
    isCanceled = true
    if (abortController) {
      abortController.abort()
      abortController = null
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
    const folder = `firechat/${roomId}/${username}`
    const resourceType = type === 'video' ? 'video' : 'image'

    uploadState.value = {
      isUploading: true,
      progress: 0,
      error: null,
    }

    isCanceled = false
    abortController = new AbortController()

    try {
      const result = await uploadToCloudinary(
        file,
        folder,
        resourceType,
        (progress: UploadProgress) => {
          if (!isCanceled) {
            uploadState.value.progress = progress.percentage
          }
        },
        abortController.signal
      )

      if (isCanceled) {
        uploadState.value.error = 'Upload canceled'
        return null
      }

      const attachment: FileAttachment = {
        url: result.url,
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
      return attachment
    } catch (error) {
      abortController = null
      uploadState.value.isUploading = false

      const errorMessage = (error as Error).message || ''
      const isAbortError = isCanceled ||
        errorMessage === 'Upload canceled' ||
        errorMessage.includes('aborted') ||
        (error as Error).name === 'AbortError'

      if (isAbortError) {
        uploadState.value.error = 'Upload canceled'
        return null
      }

      uploadState.value.error = 'Upload failed. Please try again.'
      throw error
    }
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
