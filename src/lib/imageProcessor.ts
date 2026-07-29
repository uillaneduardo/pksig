import fs from "fs";
import path from "path";
import crypto from "crypto";
import sharp, { Metadata } from "sharp";

export interface ProcessImageResult {
  thumbnailPath: string | null;
  documentPath: string | null;
  printPath: string | null;
  originalWidth: number | null;
  originalHeight: number | null;
  documentWidth: number | null;
  documentHeight: number | null;
  printWidth: number | null;
  printHeight: number | null;
  originalSize: number;
  documentSize: number | null;
  printSize: number | null;
  fileHash: string;
  processingStatus: "completed" | "failed";
  processingError?: string | null;
  processedAt?: Date | null;
}

/**
 * Checks whether a given mime type or file extension corresponds to a processable image.
 */
export function isProcessableImage(mimeType: string, filename: string): boolean {
  const mime = (mimeType || "").toLowerCase();
  const ext = path.extname(filename || "").toLowerCase();

  if (mime.startsWith("image/")) {
    // Exclude SVGs or vector formats
    if (mime.includes("svg")) return false;
    return true;
  }

  return [".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif", ".tiff"].includes(ext);
}

/**
 * Process an image file to create thumbnail (300px max, JPEG q68) and document (1200px max, JPEG q76) versions.
 * Preserves the original file untouched in storage/attachments/.
 */
export async function processImageFile(
  originalAbsolutePath: string,
  attachmentsDir: string,
  filename: string
): Promise<ProcessImageResult> {
  const fileStats = fs.statSync(originalAbsolutePath);
  const originalSize = fileStats.size;

  // Calculate SHA-256 hash of original file
  const fileBuffer = fs.readFileSync(originalAbsolutePath);
  const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

  // Inspect image metadata and validate actual image stream
  let metadata: Metadata;
  try {
    metadata = await sharp(originalAbsolutePath).metadata();
    if (!metadata.format || !metadata.width || !metadata.height) {
      throw new Error("Formato de imagem inválido ou metadados corrompidos");
    }
  } catch (err: any) {
    return {
      thumbnailPath: null,
      documentPath: null,
      printPath: null,
      originalWidth: null,
      originalHeight: null,
      documentWidth: null,
      documentHeight: null,
      printWidth: null,
      printHeight: null,
      originalSize,
      documentSize: null,
      printSize: null,
      fileHash,
      processingStatus: "failed",
      processingError: `Falha ao validar ou ler formato da imagem: ${err.message}`,
      processedAt: new Date()
    };
  }

  const origWidth = metadata.width || null;
  const origHeight = metadata.height || null;

  // Ensure derivative subdirectories exist
  const thumbDir = path.join(attachmentsDir, "thumbnail");
  const docDir = path.join(attachmentsDir, "document");
  const printDir = path.join(attachmentsDir, "print");

  if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });
  if (!fs.existsSync(docDir)) fs.mkdirSync(docDir, { recursive: true });
  if (!fs.existsSync(printDir)) fs.mkdirSync(printDir, { recursive: true });

  const baseName = path.basename(filename, path.extname(filename)).replace(/[^a-zA-Z0-9_-]/g, "_");
  const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const thumbFilename = `thumb_${baseName}_${uniqueSuffix}.jpg`;
  const docFilename = `doc_${baseName}_${uniqueSuffix}.jpg`;
  const printFilename = `print_${baseName}_${uniqueSuffix}.jpg`;

  const thumbAbsPath = path.join(thumbDir, thumbFilename);
  const docAbsPath = path.join(docDir, docFilename);
  const printAbsPath = path.join(printDir, printFilename);

  const relThumbPath = `storage/attachments/thumbnail/${thumbFilename}`;
  const relDocPath = `storage/attachments/document/${docFilename}`;
  const relPrintPath = `storage/attachments/print/${printFilename}`;

  try {
    // 1. Generate Document Version (Max 1200x1200px, JPEG quality 76, progressive, mozjpeg, white background flatten)
    const docPipeline = sharp(originalAbsolutePath)
      .rotate() // Automatically applies EXIF orientation and strips EXIF tags
      .resize({
        width: 1200,
        height: 1200,
        fit: "inside",
        withoutEnlargement: true
      })
      .flatten({ background: "#ffffff" }) // Flatten transparency onto a white background
      .jpeg({
        quality: 76,
        progressive: true,
        mozjpeg: true
      });

    const docInfo = await docPipeline.toFile(docAbsPath);

    // Copy to print path for backwards compatibility
    fs.copyFileSync(docAbsPath, printAbsPath);

    // 2. Generate Thumbnail Version (Max 300x300px, JPEG quality 68, progressive, mozjpeg, white background flatten)
    const thumbPipeline = sharp(originalAbsolutePath)
      .rotate()
      .resize({
        width: 300,
        height: 300,
        fit: "inside",
        withoutEnlargement: true
      })
      .flatten({ background: "#ffffff" })
      .jpeg({
        quality: 68,
        progressive: true,
        mozjpeg: true
      });

    await thumbPipeline.toFile(thumbAbsPath);

    const docSize = docInfo.size || fs.statSync(docAbsPath).size;

    return {
      thumbnailPath: relThumbPath,
      documentPath: relDocPath,
      printPath: relPrintPath,
      originalWidth: origWidth,
      originalHeight: origHeight,
      documentWidth: docInfo.width || null,
      documentHeight: docInfo.height || null,
      printWidth: docInfo.width || null,
      printHeight: docInfo.height || null,
      originalSize,
      documentSize: docSize,
      printSize: docSize,
      fileHash,
      processingStatus: "completed",
      processingError: null,
      processedAt: new Date()
    };
  } catch (err: any) {
    if (fs.existsSync(thumbAbsPath)) try { fs.unlinkSync(thumbAbsPath); } catch (e) {}
    if (fs.existsSync(docAbsPath)) try { fs.unlinkSync(docAbsPath); } catch (e) {}
    if (fs.existsSync(printAbsPath)) try { fs.unlinkSync(printAbsPath); } catch (e) {}

    return {
      thumbnailPath: null,
      documentPath: null,
      printPath: null,
      originalWidth: origWidth,
      originalHeight: origHeight,
      documentWidth: null,
      documentHeight: null,
      printWidth: null,
      printHeight: null,
      originalSize,
      documentSize: null,
      printSize: null,
      fileHash,
      processingStatus: "failed",
      processingError: `Erro ao processar derivados da imagem: ${err.message}`,
      processedAt: new Date()
    };
  }
}
