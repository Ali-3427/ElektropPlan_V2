import type { ExportedFile } from "./shared.js";
import { type CalculatorKind, calculatorLabel, encodeUtf8, escapePdfText } from "./shared.js";

export interface PdfPresentationRow {
  label: string;
  value: string;
}

export interface PdfPresentationSection {
  title: string;
  rows: PdfPresentationRow[];
}

export interface PdfPresentationRecord {
  id: string;
  calculator: CalculatorKind;
  title?: string;
  subtitle?: string;
  sections: PdfPresentationSection[];
}

export interface PdfPresentationDocument {
  title: string;
  subtitle?: string;
  exportedAt?: string;
  records: PdfPresentationRecord[];
}

export interface PdfExportResult extends ExportedFile<"pdf"> {
  presentationOnly: true;
}

interface PdfPage {
  lines: string[];
}

const PAGE_HEIGHT = 792;
const PAGE_WIDTH = 612;
const TOP_MARGIN = 56;
const BOTTOM_MARGIN = 48;
const LINE_HEIGHT = 16;
const MAX_LINE_CHARS = 92;

function wrapLine(value: string, maxChars = MAX_LINE_CHARS): string[] {
  if (value.length <= maxChars) {
    return [value];
  }

  const words = value.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (nextLine.length <= maxChars) {
      currentLine = nextLine;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    if (word.length <= maxChars) {
      currentLine = word;
      continue;
    }

    let offset = 0;

    while (offset < word.length) {
      const chunk = word.slice(offset, offset + maxChars);
      if (chunk.length === maxChars) {
        lines.push(chunk);
      } else {
        currentLine = chunk;
      }
      offset += maxChars;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function buildPages(document: PdfPresentationDocument): PdfPage[] {
  const maxLinesPerPage = Math.floor((PAGE_HEIGHT - TOP_MARGIN - BOTTOM_MARGIN) / LINE_HEIGHT);
  const pages: PdfPage[] = [{ lines: [] }];
  let currentPage = pages[0]!;

  const pushLine = (line: string) => {
    if (currentPage.lines.length >= maxLinesPerPage) {
      currentPage = { lines: [] };
      pages.push(currentPage);
    }

    currentPage.lines.push(line);
  };

  for (const line of wrapLine(document.title)) {
    pushLine(line);
  }

  if (document.subtitle) {
    for (const line of wrapLine(document.subtitle)) {
      pushLine(line);
    }
  }

  if (document.exportedAt) {
    pushLine(`Exported at: ${document.exportedAt}`);
  }

  pushLine("");

  for (const record of document.records) {
    pushLine(`${calculatorLabel(record.calculator)} | ${record.title ?? record.id}`);

    if (record.subtitle) {
      for (const line of wrapLine(record.subtitle)) {
        pushLine(line);
      }
    }

    for (const section of record.sections) {
      pushLine(`  ${section.title}`);

      if (section.rows.length === 0) {
        pushLine("    -");
        continue;
      }

      for (const row of section.rows) {
        const label = row.label.trim();
        const value = row.value.trim();

        for (const line of wrapLine(`    ${label}: ${value}`)) {
          pushLine(line);
        }
      }
    }

    pushLine("");
  }

  return pages;
}

function createPdfObject(id: number, body: string): string {
  return `${id} 0 obj\n${body}\nendobj\n`;
}

function buildContentStream(lines: string[]): string {
  const commands = ["BT", "/F1 11 Tf", `${TOP_MARGIN} ${PAGE_HEIGHT - TOP_MARGIN} Td`, `${LINE_HEIGHT} TL`];

  lines.forEach((line, index) => {
    if (index === 0) {
      commands.push(`(${escapePdfText(line)}) Tj`);
      return;
    }

    commands.push("T*");
    commands.push(`(${escapePdfText(line)}) Tj`);
  });

  commands.push("ET");
  return commands.join("\n");
}

export function exportPresentationToPdf(document: PdfPresentationDocument): PdfExportResult {
  const pages = buildPages(document);
  const objects: string[] = [];
  const pageIds: number[] = [];
  let nextObjectId = 1;

  const catalogId = nextObjectId++;
  const pagesId = nextObjectId++;
  const fontId = nextObjectId++;

  const contentObjectIds = pages.map(() => nextObjectId++);
  const pageObjectIds = pages.map(() => nextObjectId++);

  pages.forEach((page, index) => {
    const content = buildContentStream(page.lines);
    const contentObjectId = contentObjectIds[index]!;
    const stream = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
    objects[contentObjectId] = createPdfObject(contentObjectId, stream);
  });

  pages.forEach((_, index) => {
    const pageObjectId = pageObjectIds[index]!;
    const contentObjectId = contentObjectIds[index]!;
    pageIds.push(pageObjectId);
    objects[pageObjectId] = createPdfObject(
      pageObjectId,
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Contents ${contentObjectId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`,
    );
  });

  objects[fontId] = createPdfObject(fontId, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects[pagesId] = createPdfObject(
    pagesId,
    `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`,
  );
  objects[catalogId] = createPdfObject(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (let id = 1; id < objects.length; id += 1) {
    const objectBody = objects[id];

    if (!objectBody) {
      continue;
    }

    offsets[id] = pdf.length;
    pdf += objectBody;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n`;
  pdf += "0000000000 65535 f \n";

  for (let id = 1; id < objects.length; id += 1) {
    const offset = offsets[id] ?? 0;
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return {
    format: "pdf",
    presentationOnly: true,
    mimeType: "application/pdf",
    fileExtension: "pdf",
    data: encodeUtf8(pdf),
  };
}
