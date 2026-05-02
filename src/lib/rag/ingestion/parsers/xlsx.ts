/**
 * Excel Spreadsheet (.xlsx) Parser
 * Extracts text content from worksheets with cell structure and metadata
 */

import { strFromU8, unzipSync } from 'fflate';
import { logger } from '@/lib/logger';

export interface XLSXCell {
  address: string; // e.g., "A1", "B2"
  row: number;
  col: number;
  value: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'formula' | 'empty';
  formula?: string;
}

export interface XLSXRow {
  rowNumber: number;
  cells: XLSXCell[];
}

export interface XLSXSheet {
  name: string;
  sheetId: string;
  rows: XLSXRow[];
  columnCount: number;
  rowCount: number;
}

export interface XLSXMetadata {
  title?: string;
  subject?: string;
  creator?: string;
  keywords?: string;
  description?: string;
  lastModifiedBy?: string;
  revision?: string;
  createdAt?: Date;
  modifiedAt?: Date;
  application?: string;
  company?: string;
  category?: string;
}

export interface ParsedXLSX {
  text: string;
  sheets: XLSXSheet[];
  metadata: XLSXMetadata;
  sheetCount: number;
  totalCellCount: number;
}

/**
 * Parse an XLSX buffer and extract structured content
 */
export async function parseXLSX(buffer: Buffer): Promise<ParsedXLSX> {
  try {
    // Unzip the XLSX file (it's a ZIP archive)
    const zipData = unzipSync(new Uint8Array(buffer));

    // Parse shared strings (cell text values are stored here)
    const sharedStrings = parseSharedStrings(zipData);

    // Parse metadata
    const metadata = parseMetadata(zipData);

    // Parse workbook structure to get sheet names
    const workbookInfo = parseWorkbook(zipData);

    // Parse each worksheet
    const sheets: XLSXSheet[] = [];
    let totalCellCount = 0;

    for (const [sheetId, sheetName] of workbookInfo.sheets) {
      const sheetPath = `xl/worksheets/sheet${sheetId}.xml`;
      const sheetData = zipData[sheetPath];

      if (sheetData) {
        const sheet = parseWorksheet(strFromU8(sheetData), sheetName, sheetId, sharedStrings);
        sheets.push(sheet);
        totalCellCount += sheet.rows.reduce((sum, row) => sum + row.cells.length, 0);
      }
    }

    // Generate plain text representation
    const text = generateText(sheets);

    return {
      text,
      sheets,
      metadata,
      sheetCount: sheets.length,
      totalCellCount,
    };
  } catch (error) {
    throw new XLSXParserError(
      `Failed to parse XLSX file: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Parse shared strings XML
 */
function parseSharedStrings(zipData: Record<string, Uint8Array>): string[] {
  const sharedStringsPath = 'xl/sharedStrings.xml';
  const data = zipData[sharedStringsPath];

  if (!data) return [];

  const xml = strFromU8(data);
  const strings: string[] = [];

  // Parse <si> (shared item) elements
  const siRegex = /<si>(.*?)<\/si>/gs;
  let match: RegExpExecArray | null;

  // biome-ignore lint/suspicious/noAssignInExpressions: intentional regex loop
  while ((match = siRegex.exec(xml)) !== null) {
    const siContent = match[1];
    // Extract text from <t> elements within <si>
    const text = extractTextFromSi(siContent);
    strings.push(text);
  }

  return strings;
}

/**
 * Extract text from a shared string item
 */
function extractTextFromSi(siContent: string): string {
  const texts: string[] = [];
  const tRegex = /<t(?:\s+[^>]*)?>([^<]*)<\/t>/g;
  let match: RegExpExecArray | null;

  // biome-ignore lint/suspicious/noAssignInExpressions: intentional regex loop
  while ((match = tRegex.exec(siContent)) !== null) {
    texts.push(decodeXmlEntities(match[1]));
  }

  return texts.join('');
}

/**
 * Decode XML entities
 */
function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Parse workbook.xml to get sheet information
 */
function parseWorkbook(zipData: Record<string, Uint8Array>): { sheets: Map<string, string> } {
  const workbookPath = 'xl/workbook.xml';
  const data = zipData[workbookPath];

  const sheets = new Map<string, string>();

  if (!data) return { sheets };

  const xml = strFromU8(data);

  // Parse sheet definitions
  const sheetRegex = /<sheet\s+[^>]*name="([^"]+)"[^>]*sheetId="([^"]+)"/g;
  let match: RegExpExecArray | null;

  // biome-ignore lint/suspicious/noAssignInExpressions: intentional regex loop
  while ((match = sheetRegex.exec(xml)) !== null) {
    const name = decodeXmlEntities(match[1]);
    const sheetId = match[2];
    sheets.set(sheetId, name);
  }

  return { sheets };
}

/**
 * Parse a worksheet XML
 */
function parseWorksheet(
  xml: string,
  sheetName: string,
  sheetId: string,
  sharedStrings: string[]
): XLSXSheet {
  const rows: XLSXRow[] = [];
  const rowMap = new Map<number, XLSXCell[]>();

  // Parse row elements
  const rowRegex = /<row[^>]*>(.*?)<\/row>/gs;
  let rowMatch: RegExpExecArray | null;

  // biome-ignore lint/suspicious/noAssignInExpressions: intentional regex loop
  while ((rowMatch = rowRegex.exec(xml)) !== null) {
    const rowXml = rowMatch[1];
    const rowAttrMatch = rowMatch[0].match(/r="(\d+)"/);
    const rowNumber = rowAttrMatch ? parseInt(rowAttrMatch[1], 10) : rows.length + 1;

    const cells: XLSXCell[] = [];

    // Parse cell elements
    const cellRegex =
      /<c\s+[^>]*r="([A-Z]+\d+)"(?:\s+[^>]*)?>(?:<v>([^<]*)<\/v>)?(?:<f>([^<]*)<\/f>)?<\/c>/g;
    let cellMatch: RegExpExecArray | null;

    // biome-ignore lint/suspicious/noAssignInExpressions: intentional regex loop
    while ((cellMatch = cellRegex.exec(rowXml)) !== null) {
      const address = cellMatch[1];
      const valueContent = cellMatch[2] || '';
      const formula = cellMatch[3];

      // Parse cell type from attributes
      const typeMatch = cellMatch[0].match(/t="([^"]+)"/);
      const cellType = typeMatch ? typeMatch[1] : 'n'; // 'n' = number (default)

      const { value, type } = parseCellValue(valueContent, cellType, sharedStrings);

      const col = parseColumnFromAddress(address);

      cells.push({
        address,
        row: rowNumber,
        col,
        value,
        type,
        formula: formula ? decodeXmlEntities(formula) : undefined,
      });
    }

    if (cells.length > 0) {
      rowMap.set(rowNumber, cells);
    }
  }

  // Convert map to sorted array
  const sortedRowNumbers = Array.from(rowMap.keys()).sort((a, b) => a - b);
  for (const rowNumber of sortedRowNumbers) {
    // biome-ignore lint/style/noNonNullAssertion: rowNumber comes from rowMap.keys()
    const cells = rowMap.get(rowNumber)!;
    cells.sort((a, b) => a.col - b.col);
    rows.push({ rowNumber, cells });
  }

  // Calculate dimensions
  let columnCount = 0;
  const rowCount = rows.length;

  for (const row of rows) {
    if (row.cells.length > 0) {
      const maxCol = Math.max(...row.cells.map((c) => c.col));
      columnCount = Math.max(columnCount, maxCol + 1);
    }
  }

  return {
    name: sheetName,
    sheetId,
    rows,
    columnCount,
    rowCount,
  };
}

/**
 * Parse cell value based on type
 */
function parseCellValue(
  value: string,
  cellType: string,
  sharedStrings: string[]
): { value: string; type: XLSXCell['type'] } {
  switch (cellType) {
    case 's': {
      // Shared string
      const index = parseInt(value, 10);
      return { value: sharedStrings[index] || '', type: 'string' };
    }

    case 'str': // Inline string
      return { value: decodeXmlEntities(value), type: 'string' };

    case 'n': // Number
      return { value: value, type: 'number' };

    case 'b': // Boolean
      return { value: value === '1' ? 'TRUE' : 'FALSE', type: 'boolean' };

    case 'd': // Date (ISO 8601)
      return { value, type: 'date' };

    case 'e': // Error
      return { value: `#${value}`, type: 'string' };

    default:
      return { value: decodeXmlEntities(value), type: 'string' };
  }
}

/**
 * Parse column number from cell address (e.g., "A1" -> 0, "B2" -> 1)
 */
function parseColumnFromAddress(address: string): number {
  const colMatch = address.match(/^([A-Z]+)/);
  if (!colMatch) return 0;

  const col = colMatch[1];
  let result = 0;

  for (let i = 0; i < col.length; i++) {
    result = result * 26 + (col.charCodeAt(i) - 64); // 'A' = 65, so -64 gives 1
  }

  return result - 1; // Zero-based
}

/**
 * Parse document metadata from core.xml
 */
function parseMetadata(zipData: Record<string, Uint8Array>): XLSXMetadata {
  const corePath = 'docProps/core.xml';
  const appPath = 'docProps/app.xml';
  const data = zipData[corePath];
  const appData = zipData[appPath];

  const metadata: XLSXMetadata = {};

  if (data) {
    const xml = strFromU8(data);

    metadata.title = extractXmlTag(xml, 'dc:title');
    metadata.subject = extractXmlTag(xml, 'dc:subject');
    metadata.creator = extractXmlTag(xml, 'dc:creator');
    metadata.keywords = extractXmlTag(xml, 'cp:keywords');
    metadata.description = extractXmlTag(xml, 'dc:description');
    metadata.lastModifiedBy = extractXmlTag(xml, 'cp:lastModifiedBy');
    metadata.revision = extractXmlTag(xml, 'cp:revision');
    metadata.category = extractXmlTag(xml, 'cp:category');

    const created = extractXmlTag(xml, 'dcterms:created');
    if (created) metadata.createdAt = new Date(created);

    const modified = extractXmlTag(xml, 'dcterms:modified');
    if (modified) metadata.modifiedAt = new Date(modified);
  }

  if (appData) {
    const xml = strFromU8(appData);
    metadata.application = extractXmlTag(xml, 'Application');
    metadata.company = extractXmlTag(xml, 'Company');
  }

  return metadata;
}

/**
 * Extract content from XML tag
 */
function extractXmlTag(xml: string, tagName: string): string | undefined {
  const regex = new RegExp(`<${tagName}[^>]*>([^<]*)<\\/${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? decodeXmlEntities(match[1]) || undefined : undefined;
}

/**
 * Generate plain text representation of sheets
 */
function generateText(sheets: XLSXSheet[]): string {
  const parts: string[] = [];

  for (const sheet of sheets) {
    parts.push(`## Sheet: ${sheet.name}`);
    parts.push('');

    for (const row of sheet.rows) {
      const rowText = row.cells
        .map((cell) => cell.value)
        .filter((v) => v.length > 0)
        .join('\t');

      if (rowText.length > 0) {
        parts.push(rowText);
      }
    }

    parts.push('');
  }

  return parts.join('\n');
}

/**
 * Convert XLSX to Markdown table format
 */
export function convertToMarkdown(sheet: XLSXSheet): string {
  if (sheet.rows.length === 0) return '';

  const lines: string[] = [];
  lines.push(`### ${sheet.name}`);
  lines.push('');

  // Find the maximum column count
  let maxCols = 0;
  for (const row of sheet.rows) {
    maxCols = Math.max(maxCols, row.cells.length);
  }

  // Format rows
  for (let i = 0; i < sheet.rows.length; i++) {
    const row = sheet.rows[i];
    const cells: string[] = [];

    for (let j = 0; j < maxCols; j++) {
      const cell = row.cells.find((c) => c.col === j);
      let value = cell?.value || '';

      // Escape pipe characters in cell values
      value = value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
      cells.push(value);
    }

    lines.push(`| ${cells.join(' | ')} |`);

    // Add separator after header row (assume first row is header)
    if (i === 0) {
      lines.push(`|${' --- |'.repeat(maxCols)}`);
    }
  }

  return lines.join('\n');
}

/**
 * Extract specific sheet by name
 */
export function extractSheet(parsed: ParsedXLSX, sheetName: string): XLSXSheet | undefined {
  return parsed.sheets.find((s) => s.name.toLowerCase() === sheetName.toLowerCase());
}

/**
 * Extract sheet by index
 */
export function extractSheetByIndex(parsed: ParsedXLSX, index: number): XLSXSheet | undefined {
  return parsed.sheets[index];
}

/**
 * Get all values from a specific column
 */
export function getColumnValues(sheet: XLSXSheet, column: string): string[] {
  const colIndex = parseColumnFromAddress(`${column}1`);
  const values: string[] = [];

  for (const row of sheet.rows) {
    const cell = row.cells.find((c) => c.col === colIndex);
    if (cell?.value) {
      values.push(cell.value);
    }
  }

  return values;
}

/**
 * Validate if buffer is a valid XLSX file
 */
export function isValidXLSX(buffer: Buffer): boolean {
  try {
    // Check for ZIP magic bytes
    if (buffer.length < 4) return false;
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) return false;

    // Try to unzip and check for required files
    const zipData = unzipSync(new Uint8Array(buffer));
    return 'xl/workbook.xml' in zipData;
  } catch (error: unknown) {
    logger.debug('XLSX format detection failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * XLSX Parser Error
 */
export class XLSXParserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'XLSXParserError';
  }
}
