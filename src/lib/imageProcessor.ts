import fs from "fs";
import path from "path";
import crypto from "crypto";
import sharp, { Metadata } from "sharp";

export interface ProcessImageResult {
  thumbnailPath: string | null;
  printPath: string | null;
  originalWidth: number | null;
  originalHeight: number | null;
  printWidth: number | null;
  printHeight: number | null;
  originalSize: number;
  printSize: number | null;
  fileHash: string;
  processingStatus: "completed" | "failed";
  processingError?: string | null;
}

/**
 * Checks whether a given mime type or file extension corresponds to a processable image.
 */
export function isProcessableImage(mimeType: string, filename: string): boolean {
  const mime = (mimeType || "").toLowerCase();
  const ext = path.extname(filename || "").toLowerCase();
  
  if (mime.startsWith("image/")) {
    // Exclude SVGs or non-raster vectors if any
    if (mime.includes("svg")) return false;
    return true;
  }
  
  return [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext);
}

/**
 * Process an image file to create thumbnail (320px max) and print (1200px max) versions.
 * Preserves the original file untouched.
 */
export async function processImageFile(
  originalAbsolutePath: string,
  attachmentsDir: string,
  filename: string
): Promise<ProcessImageResult> {
  const fileStats = fs.statSync(originalAbsolutePath);
  const originalSize = fileStats.size;

  // Calculate file hash (SHA-256)
  const fileBuffer = fs.readFileSync(originalAbsolutePath);
  const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

  // Inspect image metadata
  let metadata: Metadata;
  try {
    metadata = await sharp(originalAbsolutePath).metadata();
  } catch (err: any) {
    return {
      thumbnailPath: null,
      printPath: null,
      originalWidth: null,
      originalHeight: null,
      printWidth: null,
      printHeight: null,
      originalSize,
      printSize: null,
      fileHash,
      processingStatus: "failed",
      processingError: `Falha ao ler metadados da imagem: ${err.message}`
    };
  }

  const origWidth = metadata.width || null;
  const origHeight = metadata.height || null;
  const hasAlpha = metadata.hasAlpha || false;
  const format = (metadata.format || "").toLowerCase();
  const isTransparentFormat = format === "png" || format === "webp";

  // Ensure derivative directories exist
  const thumbDir = path.join(attachmentsDir, "thumbnail");
  const printDir = path.join(attachmentsDir, "print");
  if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });
  if (!fs.existsSync(printDir)) fs.mkdirSync(printDir, { recursive: true });

  const ext = (hasAlpha && isTransparentFormat) ? ".webp" : ".jpg";
  const baseName = path.basename(filename, path.extname(filename)).replace(/[^a-zA-Z0-9_-]/g, "_");
  const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const thumbFilename = `thumb_${baseName}_${uniqueSuffix}${ext}`;
  const printFilename = `print_${baseName}_${uniqueSuffix}${ext}`;

  const thumbAbsPath = path.join(thumbDir, thumbFilename);
  const printAbsPath = path.join(printDir, printFilename);

  const relThumbPath = `storage/attachments/thumbnail/${thumbFilename}`;
  const relPrintPath = `storage/attachments/print/${printFilename}`;

  try {
    // 1. Generate Print Version (Max 1200x1200px, quality 76% JPEG / 80% WebP)
    let printPipeline = sharp(originalAbsolutePath)
      .rotate() // Correct EXIF orientation and strip metadata
      .resize({
        width: 1200,
        height: 1200,
        fit: "inside",
        withoutEnlargement: true
      });

    if (hasAlpha && isTransparentFormat) {
      printPipeline = printPipeline.webp({ quality: 80 });
    } else {
      printPipeline = printPipeline.jpeg({ quality: 76, mozjpeg: true });
    }

    const printInfo = await printPipeline.toFile(printAbsPath);

    // 2. Generate Thumbnail Version (Max 320x320px, quality 70% JPEG / 75% WebP)
    let thumbPipeline = sharp(originalAbsolutePath)
      .rotate()
      .resize({
        width: 320,
        height: 320,
        fit: "inside",
        withoutEnlargement: true
      });

    if (hasAlpha && isTransparentFormat) {
      thumbPipeline = thumbPipeline.webp({ quality: 75 });
    } else {
      thumbPipeline = thumbPipeline.jpeg({ quality: 70, mozjpeg: true });
    }

    await thumbPipeline.toFile(thumbAbsPath);

    return {
      thumbnailPath: relThumbPath,
      printPath: relPrintPath,
      originalWidth: origWidth,
      originalHeight: origHeight,
      printWidth: printInfo.width || null,
      printHeight: printInfo.height || null,
      originalSize,
      printSize: printInfo.size || fs.statSync(printAbsPath).size,
      fileHash,
      processingStatus: "completed",
      processingError: null
    };
  } catch (err: any) {
    if (fs.existsSync(thumbAbsPath)) try { fs.unlinkSync(thumbAbsPath); } catch (e) {}
    if (fs.existsSync(printAbsPath)) try { fs.unlinkSync(printAbsPath); } catch (e) {}

    return {
      thumbnailPath: null,
      printPath: null,
      originalWidth: origWidth,
      originalHeight: origHeight,
      printWidth: null,
      printHeight: null,
      originalSize,
      printSize: null,
      fileHash,
      processingStatus: "failed",
      processingError: `Erro ao processar derivados da imagem: ${err.message}`
    };
  }
}
