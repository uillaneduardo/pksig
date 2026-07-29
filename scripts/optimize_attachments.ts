import fs from "fs";
import path from "path";
import { 
  query, 
  execute, 
  isDatabaseConfigured, 
  getDatabaseConfig, 
  verifyAndRepairDatabaseSchema, 
  closePool 
} from "../src/lib/database.js";
import { processImageFile, isProcessableImage } from "../src/lib/imageProcessor.js";

async function runOptimization() {
  console.log("=========================================");
  console.log(" Otimizador de Anexos de Imagens (A4/PDF)");
  console.log("=========================================\n");

  if (!isDatabaseConfigured()) {
    console.error("ERRO: O banco de dados não está configurado. Por favor, configure o sistema antes de rodar este comando.");
    process.exit(1);
  }

  try {
    // Ensure database columns exist
    await verifyAndRepairDatabaseSchema();

    // Select all attachments that need optimization or haven't completed print/thumbnail generation
    const attachments = await query(`
      SELECT id, service_order_id, filename, file_path, file_size, mime_type, thumbnail_path, print_path, processing_status
      FROM attachments
      WHERE (print_path IS NULL OR thumbnail_path IS NULL OR processing_status IS NULL OR processing_status != 'completed')
      ORDER BY id ASC
    `);

    const imageAttachments = attachments.filter((att: any) => 
      isProcessableImage(att.mime_type, att.filename)
    );

    console.log(`Encontrados ${attachments.length} anexos totais.`);
    console.log(`Identificadas ${imageAttachments.length} imagens pendentes para otimização.\n`);

    if (imageAttachments.length === 0) {
      console.log("Todas as imagens já possuem versões de impressão e miniatura otimizadas.");
      await closePool();
      process.exit(0);
    }

    const attachmentsDir = path.join(process.cwd(), "storage", "attachments");

    let processedCount = 0;
    let successCount = 0;
    let failCount = 0;
    let totalOriginalBytes = 0;
    let totalPrintBytes = 0;

    // Concurrency limit: 2 files at a time to prevent high memory spikes
    const CONCURRENCY = 2;

    async function processSingleAttachment(att: any, index: number) {
      const currentNum = index + 1;
      const absPath = path.join(process.cwd(), att.file_path);

      if (!fs.existsSync(absPath)) {
        console.warn(`[${currentNum}/${imageAttachments.length}] Anexo #${att.id} (${att.filename}): Arquivo original não encontrado em ${att.file_path}`);
        await execute(
          `UPDATE attachments SET processing_status = 'failed', processing_error = 'Arquivo físico não encontrado' WHERE id = ?`,
          [att.id]
        );
        failCount++;
        return;
      }

      try {
        const result = await processImageFile(absPath, attachmentsDir, att.filename);

        await execute(
          `UPDATE attachments SET 
            thumbnail_path = ?, 
            print_path = ?, 
            original_width = ?, 
            original_height = ?, 
            print_width = ?, 
            print_height = ?, 
            original_size = ?, 
            print_size = ?, 
            file_hash = ?, 
            processing_status = ?, 
            processing_error = ? 
          WHERE id = ?`,
          [
            result.thumbnailPath,
            result.printPath,
            result.originalWidth,
            result.originalHeight,
            result.printWidth,
            result.printHeight,
            result.originalSize,
            result.printSize,
            result.fileHash,
            result.processingStatus,
            result.processingError || null,
            att.id
          ]
        );

        if (result.processingStatus === "completed") {
          successCount++;
          const origMb = (result.originalSize / (1024 * 1024)).toFixed(2);
          const printKb = result.printSize ? (result.printSize / 1024).toFixed(1) : "0";
          const reductionPercent = result.printSize 
            ? Math.round((1 - result.printSize / result.originalSize) * 100) 
            : 0;

          totalOriginalBytes += result.originalSize;
          totalPrintBytes += (result.printSize || 0);

          console.log(`✔ [${currentNum}/${imageAttachments.length}] Anexo #${att.id} (${att.filename}): ${origMb} MB -> ${printKb} KB (redução de ${reductionPercent}%)`);
        } else {
          failCount++;
          console.error(`✖ [${currentNum}/${imageAttachments.length}] Anexo #${att.id} (${att.filename}): ${result.processingError}`);
        }
      } catch (err: any) {
        failCount++;
        console.error(`✖ [${currentNum}/${imageAttachments.length}] Anexo #${att.id} (${att.filename}): ${err.message}`);
        await execute(
          `UPDATE attachments SET processing_status = 'failed', processing_error = ? WHERE id = ?`,
          [err.message || "Erro desconhecido", att.id]
        );
      } finally {
        processedCount++;
      }
    }

    // Process in chunks of CONCURRENCY
    for (let i = 0; i < imageAttachments.length; i += CONCURRENCY) {
      const chunk = imageAttachments.slice(i, i + CONCURRENCY);
      await Promise.all(
        chunk.map((att: any, idx: number) => processSingleAttachment(att, i + idx))
      );
    }

    console.log("\n=========================================");
    console.log(" Resumo do Processamento:");
    console.log(` Total de Imagens Processadas: ${processedCount}`);
    console.log(` Sucessos: ${successCount}`);
    console.log(` Falhas: ${failCount}`);
    if (totalOriginalBytes > 0) {
      const origMbTotal = (totalOriginalBytes / (1024 * 1024)).toFixed(2);
      const printMbTotal = (totalPrintBytes / (1024 * 1024)).toFixed(2);
      const totalSavedMb = ((totalOriginalBytes - totalPrintBytes) / (1024 * 1024)).toFixed(2);
      console.log(` Tamanho das Originais: ${origMbTotal} MB`);
      console.log(` Tamanho para Impressão: ${printMbTotal} MB`);
      console.log(` Economia de Espaço Estimada no PDF: ${totalSavedMb} MB`);
    }
    console.log("=========================================\n");

    await closePool();
    process.exit(0);
  } catch (err: any) {
    console.error("Erro fatal na execução da otimização:", err);
    await closePool();
    process.exit(1);
  }
}

runOptimization();
