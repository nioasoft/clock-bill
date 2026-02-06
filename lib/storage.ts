/**
 * Storage abstraction layer
 * Handles file uploads in both development (local filesystem) and production (Vercel Blob)
 */

import { writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import * as path from "path";
import { isProduction } from "./env";

/**
 * Storage interface for file operations
 */
export interface StorageAdapter {
  upload(file: File, userId: string, prefix: string): Promise<string>;
  delete(url: string): Promise<void>;
  getUrl(filename: string, prefix: string): string;
}

// Type definitions for Vercel Blob (optional dependency)
interface VercelBlobPutOptions {
  access: "public";
}

interface VercelBlobPutResult {
  url: string;
}

// Dynamic import for Vercel Blob (only available in production when package is installed)
let blobPut: ((filename: string, file: File, options: VercelBlobPutOptions) => Promise<VercelBlobPutResult>) | null = null;
let blobDel: ((pathname: string) => Promise<void>) | null = null;

// Try to load Vercel Blob in production
if (isProduction() && process.env.BLOB_READ_WRITE_TOKEN) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const blob = require("@vercel/blob");
    blobPut = blob.put;
    blobDel = blob.del;
  } catch (error) {
    console.warn("@vercel/blob not available, falling back to local storage");
  }
}

/**
 * Local filesystem storage (development)
 */
class LocalStorageAdapter implements StorageAdapter {
  private getUploadDir(prefix: string): string {
    return path.join(process.cwd(), "public", "uploads", prefix);
  }

  private async ensureUploadDir(prefix: string): Promise<void> {
    const dir = this.getUploadDir(prefix);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }

  private generateFilename(userId: string, originalName: string): string {
    const timestamp = Date.now();
    const extension = path.extname(originalName) || ".png";
    return `${userId}_${timestamp}${extension}`;
  }

  async upload(file: File, userId: string, prefix: string): Promise<string> {
    await this.ensureUploadDir(prefix);

    const filename = this.generateFilename(userId, file.name);
    const filepath = path.join(this.getUploadDir(prefix), filename);

    // Convert File to Buffer and save
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    return `/uploads/${prefix}/${filename}`;
  }

  async delete(url: string): Promise<void> {
    const filename = path.basename(url);
    const filepath = path.join(process.cwd(), "public", url);

    try {
      if (existsSync(filepath)) {
        await unlink(filepath);
      }
    } catch (error) {
      console.error("Failed to delete file:", error);
      // Continue even if file deletion fails
    }
  }

  getUrl(filename: string, prefix: string): string {
    return `/uploads/${prefix}/${filename}`;
  }
}

/**
 * Vercel Blob storage (production)
 */
class BlobStorageAdapter implements StorageAdapter {
  async upload(file: File, userId: string, prefix: string): Promise<string> {
    if (!blobPut) {
      throw new Error("Vercel Blob not available");
    }

    const timestamp = Date.now();
    const extension = path.extname(file.name) || ".png";
    const filename = `${prefix}/${userId}_${timestamp}${extension}`;

    const blob = await blobPut(filename, file, {
      access: "public",
    });

    return blob.url;
  }

  async delete(url: string): Promise<void> {
    if (!blobDel) {
      console.warn("Vercel Blob del not available, skipping delete");
      return;
    }

    try {
      // Extract the blob path from the URL
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;

      // Delete from Vercel Blob
      await blobDel(pathname);
    } catch (error) {
      console.error("Failed to delete blob:", error);
      // Continue even if blob deletion fails
    }
  }

  getUrl(filename: string, prefix: string): string {
    // This method is not used for Blob storage since URLs are returned by put()
    throw new Error("getUrl() should not be called for Blob storage");
  }
}

/**
 * Get the appropriate storage adapter based on environment
 */
export function getStorageAdapter(): StorageAdapter {
  // In production, use Vercel Blob if token is available AND package is installed
  // Otherwise fall back to local storage (for compatibility)
  if (isProduction() && process.env.BLOB_READ_WRITE_TOKEN && blobPut && blobDel) {
    return new BlobStorageAdapter();
  }

  // Development: use local filesystem
  return new LocalStorageAdapter();
}

/**
 * Upload a file using the appropriate storage adapter
 */
export async function uploadFile(
  file: File,
  userId: string,
  prefix: string = "logos"
): Promise<string> {
  const storage = getStorageAdapter();
  return storage.upload(file, userId, prefix);
}

/**
 * Delete a file using the appropriate storage adapter
 */
export async function deleteFile(url: string): Promise<void> {
  const storage = getStorageAdapter();
  return storage.delete(url);
}
