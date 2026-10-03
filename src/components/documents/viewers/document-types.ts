interface DocLike {
  type: string;
  name: string;
}

export function isPdf(doc: DocLike): boolean {
  return doc.type === 'application/pdf' || /\.pdf$/i.test(doc.name);
}

export function isImage(doc: DocLike): boolean {
  return doc.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(doc.name);
}

export function isMarkdown(doc: DocLike): boolean {
  return (
    doc.type === 'text/markdown' ||
    doc.type === 'application/md' ||
    /\.(md|mdx|markdown)$/i.test(doc.name)
  );
}

export function isText(doc: DocLike): boolean {
  return (
    doc.type.startsWith('text/') ||
    /\.(txt|csv|json|yaml|yml|log|ini|conf|cfg|env|sh|bash|zsh|ts|tsx|js|jsx|py|rb|go|rs|java|c|cpp|h|hpp|sql|xml|toml)$/i.test(
      doc.name
    )
  );
}

export function isDocx(doc: DocLike): boolean {
  return (
    doc.type === 'application/docx' ||
    doc.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    /\.docx?$/i.test(doc.name)
  );
}

export function isHtml(doc: DocLike): boolean {
  return (
    doc.type === 'text/html' ||
    doc.type === 'application/html' ||
    doc.type === 'application/xhtml+xml' ||
    /\.(html?|xhtml)$/i.test(doc.name)
  );
}

export function isSpreadsheet(doc: DocLike): boolean {
  return (
    doc.type === 'application/xlsx' ||
    doc.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    /\.(xlsx?|csv|tsv)$/i.test(doc.name)
  );
}

export function isPresentation(doc: DocLike): boolean {
  return (
    doc.type === 'application/pptx' ||
    doc.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    /\.pptx?$/i.test(doc.name)
  );
}
