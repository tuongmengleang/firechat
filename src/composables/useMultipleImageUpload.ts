import { ref, computed } from 'vue'
import { uploadToS3, type UploadProgress } from '@/config/s3'
import type { FileAttachment, ImagePreview, MultipleUploadState } from '@/types/chat'
import {
  ALLOWED_IMAGE_TYPES,
  MAX_FILE_SIZE,
  MAX_IMAGES_PER_MESSAGE,
} from '@/types/chat'

let idCounter = 0
const generateId = (): string => `img_${Date.now()}_${++idCounter}`

export function useMultipleImageUpload(roomId: string = 'general') {
  const imagePreviews = ref<ImagePreview[]>([])
  const uploadState = ref<MultipleUploadState>({
    isUploading: false,
    totalProgress: 0,
    completedCount: 0,
    totalCount: 0,
    error: null,
  })

  const abortControllers = new Map<string, AbortController>()
  let isCanceled = false

  const hasImages = computed(() => imagePreviews.value.length > 0)
  const pendingCount = computed(() =>
    imagePreviews.value.filter(p => p.status === 'pending').length
  )
  const canAddMore = computed(() =>
    imagePreviews.value.length < MAX_IMAGES_PER_MESSAGE
  )

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const validateImage = (file: File): string | null => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return 'Only JPEG, PNG, GIF, and WebP images are allowed.'
    }
    if (file.size > MAX_FILE_SIZE) {
      return `Image too large. Max size is ${formatFileSize(MAX_FILE_SIZE)}.`
    }
    return null
  }

  const addImages = (files: FileList | File[]): { added: number; errors: string[] } => {
    uploadState.value.error = null
    const errors: string[] = []
    let addedCount = 0

    const fileArray = Array.from(files)
    const availableSlots = MAX_IMAGES_PER_MESSAGE - imagePreviews.value.length

    if (fileArray.length > availableSlots) {
      errors.push(`Can only add ${availableSlots} more image${availableSlots !== 1 ? 's' : ''}.`)
    }

    const filesToAdd = fileArray.slice(0, availableSlots)

    for (const file of filesToAdd) {
      const error = validateImage(file)
      if (error) {
        errors.push(`${file.name}: ${error}`)
        continue
      }

      const previewUrl = URL.createObjectURL(file)
      const preview: ImagePreview = {
        id: generateId(),
        file,
        url: previewUrl,
        name: file.name,
        size: file.size,
        status: 'pending',
        progress: 0,
      }

      imagePreviews.value.push(preview)
      addedCount++
    }

    if (errors.length > 0) {
      uploadState.value.error = errors.join(' ')
    }

    return { added: addedCount, errors }
  }

  const removeImage = (id: string): void => {
    const index = imagePreviews.value.findIndex(p => p.id === id)
    if (index === -1) return

    const preview = imagePreviews.value[index]
    if (!preview) return

    // Abort upload if in progress
    const controller = abortControllers.get(id)
    if (controller) {
      controller.abort()
      abortControllers.delete(id)
    }

    // Revoke object URL
    URL.revokeObjectURL(preview.url)

    // Remove from array
    imagePreviews.value.splice(index, 1)
  }

  const clearAll = (): void => {
    // Abort all uploads
    for (const controller of abortControllers.values()) {
      controller.abort()
    }
    abortControllers.clear()

    // Revoke all object URLs
    for (const preview of imagePreviews.value) {
      URL.revokeObjectURL(preview.url)
    }

    imagePreviews.value = []
    uploadState.value = {
      isUploading: false,
      totalProgress: 0,
      completedCount: 0,
      totalCount: 0,
      error: null,
    }
  }

  const cancelUpload = (): void => {
    isCanceled = true
    for (const controller of abortControllers.values()) {
      controller.abort()
    }
    abortControllers.clear()

    // Reset upload state but keep previews
    for (const preview of imagePreviews.value) {
      if (preview.status === 'uploading') {
        preview.status = 'pending'
        preview.progress = 0
      }
    }

    uploadState.value = {
      isUploading: false,
      totalProgress: 0,
      completedCount: 0,
      totalCount: 0,
      error: 'Upload canceled',
    }
  }

  const updateTotalProgress = (): void => {
    const total = imagePreviews.value.length
    if (total === 0) {
      uploadState.value.totalProgress = 0
      return
    }

    const sum = imagePreviews.value.reduce((acc, p) => acc + p.progress, 0)
    uploadState.value.totalProgress = Math.round(sum / total)
  }

  const uploadSingleImage = async (
    preview: ImagePreview,
    username: string
  ): Promise<FileAttachment | null> => {
    const timestamp = Date.now()
    const sanitizedName = preview.file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const key = `chatRooms/${roomId}/${username}/${timestamp}_${sanitizedName}`

    preview.status = 'uploading'
    preview.progress = 0

    const controller = new AbortController()
    abortControllers.set(preview.id, controller)

    try {
      const result = await uploadToS3(
        preview.file,
        key,
        preview.file.type,
        (progress: UploadProgress) => {
          if (!isCanceled) {
            preview.progress = progress.percentage
            updateTotalProgress()
          }
        },
        controller.signal
      )

      if (isCanceled) {
        preview.status = 'error'
        preview.error = 'Canceled'
        return null
      }

      preview.status = 'completed'
      preview.progress = 100
      uploadState.value.completedCount++
      updateTotalProgress()

      abortControllers.delete(preview.id)

      return {
        url: result.url,
        type: 'image',
        name: preview.name,
        size: preview.size,
        mimeType: preview.file.type,
      }
    } catch (error) {
      abortControllers.delete(preview.id)

      const errorMessage = (error as Error).message || ''
      const isAbortError = isCanceled ||
        errorMessage === 'Upload canceled' ||
        errorMessage.includes('aborted') ||
        (error as Error).name === 'AbortError'

      if (isAbortError) {
        preview.status = 'error'
        preview.error = 'Canceled'
        return null
      }

      preview.status = 'error'
      preview.error = 'Upload failed'
      throw error
    }
  }

  const uploadImages = async (
    username: string,
    onProgress?: (completed: number, total: number) => void
  ): Promise<FileAttachment[]> => {
    const pendingImages = imagePreviews.value.filter(p => p.status === 'pending')

    if (pendingImages.length === 0) return []

    uploadState.value = {
      isUploading: true,
      totalProgress: 0,
      completedCount: 0,
      totalCount: pendingImages.length,
      error: null,
    }

    isCanceled = false
    const results: FileAttachment[] = []
    const errors: string[] = []

    // Upload images in parallel (max 3 concurrent)
    const concurrency = 3
    const chunks: ImagePreview[][] = []

    for (let i = 0; i < pendingImages.length; i += concurrency) {
      chunks.push(pendingImages.slice(i, i + concurrency))
    }

    for (const chunk of chunks) {
      if (isCanceled) break

      const uploadPromises = chunk.map(async (preview) => {
        try {
          const attachment = await uploadSingleImage(preview, username)
          if (attachment) {
            results.push(attachment)
          }
          onProgress?.(uploadState.value.completedCount, uploadState.value.totalCount)
        } catch (error) {
          errors.push(`${preview.name}: Upload failed`)
        }
      })

      await Promise.all(uploadPromises)
    }

    uploadState.value.isUploading = false

    if (errors.length > 0) {
      uploadState.value.error = errors.join('; ')
    }

    // Clear completed images
    const completedIds = imagePreviews.value
      .filter(p => p.status === 'completed')
      .map(p => p.id)

    for (const id of completedIds) {
      const preview = imagePreviews.value.find(p => p.id === id)
      if (preview) {
        URL.revokeObjectURL(preview.url)
      }
    }

    imagePreviews.value = imagePreviews.value.filter(p => p.status !== 'completed')

    return results
  }

  const reorderImages = (fromIndex: number, toIndex: number): void => {
    if (
      fromIndex < 0 ||
      fromIndex >= imagePreviews.value.length ||
      toIndex < 0 ||
      toIndex >= imagePreviews.value.length
    ) {
      return
    }

    const removed = imagePreviews.value.splice(fromIndex, 1)
    const item = removed[0]
    if (item) {
      imagePreviews.value.splice(toIndex, 0, item)
    }
  }

  return {
    imagePreviews,
    uploadState,
    hasImages,
    pendingCount,
    canAddMore,
    addImages,
    removeImage,
    clearAll,
    cancelUpload,
    uploadImages,
    reorderImages,
    formatFileSize,
  }
}