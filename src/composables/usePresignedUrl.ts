import { ref, watch, onUnmounted } from 'vue'
import { isCloudinaryUrl } from '@/config/cloudinary'

/**
 * Resolve a media URL - Cloudinary URLs are already public,
 * so we just return them as-is
 */
async function resolveMediaUrl(originalUrl: string): Promise<string> {
  // Cloudinary URLs are already public and don't need presigning
  if (isCloudinaryUrl(originalUrl)) {
    return originalUrl
  }

  // For any other URLs, return as-is
  return originalUrl
}

/**
 * Composable for resolving media URLs
 * Cloudinary URLs are already public and load instantly
 */
export function usePresignedUrl(originalUrl: () => string) {
  const resolvedUrl = ref<string>('')
  const isLoading = ref(true)
  const error = ref<string | null>(null)

  let isMounted = true

  const resolveUrl = async () => {
    const url = originalUrl()
    if (!url) {
      resolvedUrl.value = ''
      isLoading.value = false
      return
    }

    isLoading.value = true
    error.value = null

    try {
      const resolved = await resolveMediaUrl(url)
      if (isMounted) {
        resolvedUrl.value = resolved
        isLoading.value = false
      }
    } catch (err) {
      if (isMounted) {
        console.error('Failed to resolve URL:', err)
        error.value = 'Failed to load media'
        // Fallback to original URL
        resolvedUrl.value = url
        isLoading.value = false
      }
    }
  }

  // Watch for URL changes and resolve
  watch(originalUrl, resolveUrl, { immediate: true })

  onUnmounted(() => {
    isMounted = false
  })

  return {
    resolvedUrl,
    isLoading,
    error,
  }
}