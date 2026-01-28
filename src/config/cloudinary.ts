import { Cloudinary } from 'cloudinary-core'

const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string || 'leangdev'
const apiKey = import.meta.env.VITE_CLOUDINARY_API_KEY as string
const apiSecret = import.meta.env.VITE_CLOUDINARY_API_SECRET as string

// Initialize Cloudinary instance for URL transformations
export const cloudinary = new Cloudinary({ cloud_name: cloudName, secure: true })

export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

export interface UploadResult {
  url: string
  publicId: string
}

/**
 * Generate SHA-1 hash for Cloudinary signature
 */
async function sha1(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate Cloudinary upload signature
 */
async function generateSignature(params: Record<string, string | number>): Promise<string> {
  // Sort parameters alphabetically and create the string to sign
  const sortedKeys = Object.keys(params).sort()
  const paramString = sortedKeys
    .map(key => `${key}=${params[key]}`)
    .join('&')

  // Append API secret and generate SHA-1 hash
  const stringToSign = paramString + apiSecret
  return sha1(stringToSign)
}

/**
 * Upload a file to Cloudinary with progress tracking (signed upload)
 */
export async function uploadToCloudinary(
  file: Blob,
  folder: string,
  resourceType: 'image' | 'video' | 'raw' | 'auto' = 'auto',
  onProgress?: (progress: UploadProgress) => void,
  abortSignal?: AbortSignal
): Promise<UploadResult> {
  // Check if already aborted
  if (abortSignal?.aborted) {
    throw new Error('Upload canceled')
  }

  const timestamp = Math.floor(Date.now() / 1000)

  // Parameters to sign (alphabetically sorted)
  const paramsToSign: Record<string, string | number> = {
    folder,
    timestamp,
  }

  // Generate signature
  const signature = await generateSignature(paramsToSign)

  const formData = new FormData()
  formData.append('file', file)
  formData.append('folder', folder)
  formData.append('timestamp', timestamp.toString())
  formData.append('api_key', apiKey)
  formData.append('signature', signature)

  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    // Handle abort signal
    const abortHandler = () => {
      xhr.abort()
    }
    abortSignal?.addEventListener('abort', abortHandler)

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress({
          loaded: event.loaded,
          total: event.total,
          percentage: Math.round((event.loaded / event.total) * 100),
        })
      }
    })

    xhr.addEventListener('load', () => {
      abortSignal?.removeEventListener('abort', abortHandler)
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText)
          resolve({
            url: response.secure_url,
            publicId: response.public_id,
          })
        } catch {
          reject(new Error('Failed to parse upload response'))
        }
      } else {
        let errorMessage = `Upload failed with status ${xhr.status}`
        try {
          const errorResponse = JSON.parse(xhr.responseText)
          if (errorResponse.error?.message) {
            errorMessage = errorResponse.error.message
          }
        } catch {
          // Use default error message
        }
        reject(new Error(errorMessage))
      }
    })

    xhr.addEventListener('error', () => {
      abortSignal?.removeEventListener('abort', abortHandler)
      reject(new Error('Upload failed due to network error'))
    })

    xhr.addEventListener('abort', () => {
      abortSignal?.removeEventListener('abort', abortHandler)
      reject(new Error('Upload canceled'))
    })

    xhr.open('POST', uploadUrl)
    xhr.send(formData)
  })
}

/**
 * Get the Cloudinary URL for a resource
 * Since Cloudinary URLs are already public, this just returns the URL as-is
 */
export function getCloudinaryUrl(url: string): string {
  return url
}

/**
 * Check if a URL is a Cloudinary URL
 */
export function isCloudinaryUrl(url: string): boolean {
  return url.includes('cloudinary.com') || url.includes('res.cloudinary.com')
}