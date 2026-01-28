import { S3Client, PutObjectCommand, GetObjectCommand, type PutObjectCommandInput } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const endpoint = import.meta.env.VITE_MINIO_ENDPOINT as string
const accessKeyId = import.meta.env.VITE_MINIO_ACCESS_KEY as string
const secretAccessKey = import.meta.env.VITE_MINIO_SECRET_KEY as string
export const bucket = import.meta.env.VITE_MINIO_BUCKET as string

export const s3Client = new S3Client({
  endpoint,
  region: 'us-east-1', // MinIO doesn't care about region, but SDK requires it
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  forcePathStyle: true, // Required for MinIO
})

export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

export interface UploadResult {
  url: string
  key: string
}

/**
 * Upload a file to MinIO S3 with progress tracking using presigned URL
 */
export async function uploadToS3(
  file: Blob,
  key: string,
  contentType: string,
  onProgress?: (progress: UploadProgress) => void,
  abortSignal?: AbortSignal
): Promise<UploadResult> {
  // Check if already aborted
  if (abortSignal?.aborted) {
    throw new Error('Upload canceled')
  }

  // Generate a presigned URL for the PUT operation
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  })

  const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 })

  // Check again after presigning
  if (abortSignal?.aborted) {
    throw new Error('Upload canceled')
  }

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
        resolve({
          url: `${endpoint}/${bucket}/${key}`,
          key,
        })
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.statusText}`))
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

    xhr.open('PUT', presignedUrl)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.send(file)
  })
}

/**
 * Upload a file to MinIO S3 using AWS SDK (no progress tracking but more reliable)
 */
export async function uploadToS3WithSDK(
  file: Blob,
  key: string,
  contentType: string
): Promise<UploadResult> {
  const arrayBuffer = await file.arrayBuffer()
  const uint8Array = new Uint8Array(arrayBuffer)

  const params: PutObjectCommandInput = {
    Bucket: bucket,
    Key: key,
    Body: uint8Array,
    ContentType: contentType,
  }

  await s3Client.send(new PutObjectCommand(params))

  return {
    url: `${endpoint}/${bucket}/${key}`,
    key,
  }
}

/**
 * Get the public URL for an S3 object
 */
export function getS3Url(key: string): string {
  return `${endpoint}/${bucket}/${key}`
}

/**
 * Extract the S3 key from a full S3 URL
 */
export function extractKeyFromUrl(url: string): string | null {
  const prefix = `${endpoint}/${bucket}/`
  if (url.startsWith(prefix)) {
    return url.slice(prefix.length)
  }
  return null
}

/**
 * Generate a presigned URL for downloading/viewing a file from MinIO S3
 */
export async function getPresignedDownloadUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  })

  return getSignedUrl(s3Client, command, { expiresIn })
}