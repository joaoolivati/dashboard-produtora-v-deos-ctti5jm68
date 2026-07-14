export function parseCSV(csvString: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let currentVal = ''
  let inQuotes = false
  const MAX_FIELD_LENGTH = 100000

  const str = csvString
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u2028/g, '\n')
    .replace(/\u2029/g, '\n')
    .replace(/\u0085/g, '\n')
    .replaceAll('\u000B', '\n')
    .replaceAll('\u000C', '\n')

  for (let i = 0; i < str.length; i++) {
    const char = str[i]
    if (inQuotes) {
      if (currentVal.length > MAX_FIELD_LENGTH) {
        inQuotes = false
        if (char === ',') {
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
      } else if (char === '"') {
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
