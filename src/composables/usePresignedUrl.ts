import { ref, watch, onUnmounted } from 'vue'
import { getPresignedDownloadUrl, extractKeyFromUrl } from '@/config/s3'

interface CacheEntry {
  url: string
  expiresAt: number
}

// Global cache for presigned URLs (shared across components)
const urlCache = new Map<string, CacheEntry>()

// Cache duration: 50 minutes (presigned URLs expire in 1 hour)
const CACHE_DURATION_MS = 50 * 60 * 1000

/**
 * Get a presigned URL with caching
 */
async function getCachedPresignedUrl(originalUrl: string): Promise<string> {
  const now = Date.now()
  const cached = urlCache.get(originalUrl)

  if (cached && cached.expiresAt > now) {
    return cached.url
  }

  const key = extractKeyFromUrl(originalUrl)
  if (!key) {
    // If it's not an S3 URL, return as-is
    return originalUrl
  }

  const presignedUrl = await getPresignedDownloadUrl(key)

  urlCache.set(originalUrl, {
    url: presignedUrl,
    expiresAt: now + CACHE_DURATION_MS,
  })

  return presignedUrl
}

/**
 * Composable for resolving S3 URLs to presigned URLs
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
      const presigned = await getCachedPresignedUrl(url)
      if (isMounted) {
        resolvedUrl.value = presigned
        isLoading.value = false
      }
    } catch (err) {
      if (isMounted) {
        console.error('Failed to get presigned URL:', err)
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

/**
 * Clear expired entries from the cache
 */
export function cleanupUrlCache(): void {
  const now = Date.now()
  for (const [key, entry] of urlCache.entries()) {
    if (entry.expiresAt <= now) {
      urlCache.delete(key)
    }
  }
}

// Periodically clean up expired cache entries
if (typeof window !== 'undefined') {
  setInterval(cleanupUrlCache, 5 * 60 * 1000) // Every 5 minutes
}