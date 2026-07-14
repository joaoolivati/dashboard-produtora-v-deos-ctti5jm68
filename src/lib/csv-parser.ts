export function parseCSV(csvString: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let currentVal = ''
  let inQuotes = false

  // Strip UTF-8 BOM (causes first header mismatch) and normalize line endings
  const str = csvString
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')

  for (let i = 0; i < str.length; i++) {
    const char = str[i]
    if (inQuotes) {
      if (char === '"') {
        if (str[i + 1] === '"') {
          currentVal += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        currentVal += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        row.push(currentVal.trim())
        currentVal = ''
      } else if (char === '\n') {
        row.push(currentVal.trim())
        if (row.some((v) => v)) rows.push(row)
        row = []
        currentVal = ''
      } else {
        currentVal += char
      }
    }
  }
  row.push(currentVal.trim())
  if (row.some((v) => v)) rows.push(row)

  if (rows.length < 2) return []

  const headers = rows[0]
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => {
      obj[h] = r[i] || ''
    })
    return obj
  })
}
