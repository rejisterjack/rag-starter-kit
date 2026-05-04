# Security Advisory: pdf-parse Dependency

**Severity:** Low
**CVE:** N/A (unmaintained package, prototype pollution risk)
**Affected Version:** `pdf-parse@1.1.1` (current)
**Status:** Pending migration

## Background

The `pdf-parse` package (v1.1.1) is the last published version from 2019. The package
is effectively unmaintained:
- No releases in 5+ years
- Open security issues unresolved
- Known prototype pollution vulnerability via crafted PDF metadata
- Depends on outdated `pdf.js` internals

While the risk is **Low** (requires a malicious PDF to be uploaded), the lack of
maintenance means new vulnerabilities will never be patched.

## Impact

An attacker who can upload a specially crafted PDF could potentially:
1. Trigger prototype pollution in the Node.js process
2. Cause denial of service via infinite loops in malformed PDF parsing
3. In extreme cases, achieve code execution (theoretical, unconfirmed)

## Current Mitigations

The application already has defenses that reduce the practical risk:
- File type validation (magic bytes check)
- Virus scanning (ClamAV when enabled)
- Processing in background jobs (Inngest) — isolation from the main process
- File size limits (50MB cap)

## Recommended Migration

### Option 1: `unpdf` (Recommended)

[`unpdf`](https://github.com/nicolo-ribaudo/unpdf) is a modern, actively maintained
PDF text extraction library built on Mozilla's latest pdf.js.

```bash
pnpm remove pdf-parse
pnpm add unpdf
pnpm remove @types/pdf-parse  # No longer needed
```

**Migration code:**

```typescript
// Before (pdf-parse)
import pdfParse from 'pdf-parse';

export async function parsePDF(buffer: Buffer): Promise<string> {
  const result = await pdfParse(buffer);
  return result.text;
}

// After (unpdf)
import { extractText } from 'unpdf';

export async function parsePDF(buffer: Buffer): Promise<string> {
  const { text } = await extractText(buffer);
  return text;
}
```

### Option 2: `pdf2json`

[`pdf2json`](https://github.com/nicolo-ribaudo/pdf2json) provides structured text
extraction with layout awareness.

```bash
pnpm remove pdf-parse
pnpm add pdf2json
```

### Option 3: `pdfjs-dist` (Direct)

Use Mozilla's `pdfjs-dist` directly for maximum control:

```bash
pnpm remove pdf-parse
pnpm add pdfjs-dist
```

```typescript
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

export async function parsePDF(buffer: Buffer): Promise<string> {
  const data = new Uint8Array(buffer);
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .filter((item): item is { str: string } => 'str' in item)
      .map((item) => item.str)
      .join(' ');
    pages.push(text);
  }

  return pages.join('\n\n');
}
```

## Testing the Migration

1. Ensure existing PDF ingestion tests pass:
   ```bash
   pnpm test:unit -- --grep "pdf"
   ```

2. Test with sample PDFs of varying complexity:
   - Simple text PDFs
   - Multi-page PDFs with images
   - PDFs with tables/columns
   - Scanned PDFs (should fall through to OCR)
   - Password-protected PDFs (should fail gracefully)

## Timeline

- **Immediate:** No action required (mitigations in place)
- **Next Sprint:** Evaluate `unpdf` in a feature branch
- **Within 30 days:** Complete migration and remove `pdf-parse`

## References

- https://github.com/nicolo-ribaudo/unpdf
- https://www.npmjs.com/package/pdf-parse (last publish: 2019)
- https://snyk.io/vuln/npm:pdf-parse
