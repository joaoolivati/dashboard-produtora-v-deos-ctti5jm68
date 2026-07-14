export function parseCSV(csvString: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let currentVal = ''
  let inQuotes = false

  const str = csvString.replace(/\r\n/g, '\n')

  for (let i = 0; i < str.length; i++) {
    const char = str[i]
    if (char === '"') {
      if (str[i + 1] === '"') {
        currentVal += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentVal.trim())
      currentVal = ''
    } else if (char === '\n' && !inQuotes) {
      row.push(currentVal.trim())
      if (row.some((v) => v)) rows.push(row)
      row = []
      currentVal = ''
    } else {
      currentVal += char
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
