import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { JobHandler } from '../domain/job';
import { logger } from '../utils/logger';

type GeneratePdfPayload = { text?: string };

/** Example application code: creates a small one-page PDF in the output folder. */
export const generatePdfHandler: JobHandler<GeneratePdfPayload> = async payload => {
  if (typeof payload?.text !== 'string') {
    throw new Error('generate_pdf payload must include a text string');
  }

  const text = payload.text.replace(/[^\x20-\x7E]/g, '?').replace(/[()\\]/g, '\\$&');
  const stream = `BT /F1 18 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf, 'ascii'));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, 'ascii');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  const outputDirectory = path.resolve(process.env.PDF_OUTPUT_DIR ?? 'generated-pdfs');
  await mkdir(outputDirectory, { recursive: true });
  const outputPath = path.join(outputDirectory, `job-${randomUUID()}.pdf`);
  await writeFile(outputPath, pdf, 'ascii');
  logger.info('Example PDF generated', { outputPath });
};
