/** Extracts plain text (with line breaks) from a PDF. pdf.js is loaded on demand. */
export async function pdfToText(file: Blob): Promise<string> {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  try {
    const doc = await task.promise
    let out = ''
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p)
      const content = await page.getTextContent()
      for (const item of content.items) {
        if (!('str' in item)) continue
        out += item.str
        if (item.hasEOL) out += '\n'
      }
      out += '\n'
    }
    return out
  } finally {
    await task.destroy()
  }
}
