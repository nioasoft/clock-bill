/**
 * Storage abstraction layer
 * Handles file uploads in both development (local filesystem) and production (Vercel Blob)
 */

import { writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import { randomUUID } from "crypto";
import * as path from "path";
import { isProduction } from "./env";

interface SniffResult {
  mime: string;
  ext: string;
}

/**
 * Identify an image by its magic bytes (not the client-supplied MIME/extension,
 * which are forgeable). Returns null for anything that isn't an allowed image,
 * so an HTML/script polyglot named photo.png is rejected before it's stored as
 * same-origin content. Thrown as UNSUPPORTED_FILE_CONTENT by the adapters.
 */
export function sniffImageType(buf: Buffer): SniffResult | null {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { mime: "image/png", ext: "png" };
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  if (buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) {
    return { mime: "image/gif", ext: "gif" };
  }
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}

/** Read the file's bytes and validate them as an allowed image, or throw. */
async function readValidatedImage(file: File): Promise<{ buffer: Buffer; ext: string }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const sniff = sniffImageType(buffer);
  if (!sniff) throw new Error("UNSUPPORTED_FILE_CONTENT");
  return { buffer, ext: sniff.ext };
}

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
let blobPut: ((filename: string, file: File | Buffer, options: VercelBlobPutOptions) => Promise<VercelBlobPutResult>) | null = null;
let blobDel: ((pathname: string) => Promise<void>) | null = null;
let blobInitialized = false;

// Lazily load Vercel Blob in production
async function initBlobStorage(): Promise<void> {
  if (blobInitialized) return;
  blobInitialized = true;

  if (isProduction() && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const blob = await import("@vercel/blob");
      blobPut = blob.put;
      blobDel = blob.del;
    } catch {
      console.warn("@vercel/blob not available, falling back to local storage");
    }
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

  async upload(file: File, _userId: string, prefix: string): Promise<string> {
    await this.ensureUploadDir(prefix);

    // Validate by magic bytes and derive a safe extension; random-UUID name so
    // the key leaks no user id / timestamp and can never be an executable .html.
    const { buffer, ext } = await readValidatedImage(file);
    const filename = `${randomUUID()}.${ext}`;
    const filepath = path.join(this.getUploadDir(prefix), filename);
    await writeFile(filepath, buffer);

    return `/uploads/${prefix}/${filename}`;
  }

  async delete(url: string): Promise<void> {
    const filepath = path.join(process.cwd(), "public", url);

    if (existsSync(filepath)) {
      await unlink(filepath);
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
  async upload(file: File, _userId: string, prefix: string): Promise<string> {
    if (!blobPut) {
      throw new Error("Vercel Blob not available");
    }

    // Magic-byte validation + random-UUID key (no user id / timestamp leak).
    const { buffer, ext } = await readValidatedImage(file);
    const filename = `${prefix}/${randomUUID()}.${ext}`;

    const blob = await blobPut(filename, buffer, {
      access: "public",
    });

    return blob.url;
  }

  async delete(url: string): Promise<void> {
    if (!blobDel) {
      throw new Error("Vercel Blob del is not available");
    }

    // Extract the blob path from the URL and let errors propagate. Callers that
    // prefer best-effort cleanup already catch errors; account deletion does not.
    const urlObj = new URL(url);
    await blobDel(urlObj.pathname);
  }

  getUrl(_filename: string, _prefix: string): string {
    // This method is not used for Blob storage since URLs are returned by put()
    throw new Error("getUrl() should not be called for Blob storage");
  }
}

/**
 * Get the appropriate storage adapter based on environment
 */
export async function getStorageAdapter(): Promise<StorageAdapter> {
  await initBlobStorage();

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
  const storage = await getStorageAdapter();
  return storage.upload(file, userId, prefix);
}

/**
 * Delete a file using the appropriate storage adapter
 */
export async function deleteFile(url: string): Promise<void> {
  const storage = await getStorageAdapter();
  return storage.delete(url);
}
