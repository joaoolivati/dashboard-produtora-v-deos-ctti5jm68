export function formatBRLInput(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function parseBRLInput(value: string): number {
  const cleaned = value.replace(/\./g, '').replace(',', '.')
  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? 0 : parsed
}

export function handleBRLInputChange(value: string): string {
  let v = value.replace(/[^\d,]/g, '')
  const commaIdx = v.indexOf(',')
  if (commaIdx !== -1) {
    const before = v.slice(0, commaIdx)
    const after = v
      .slice(commaIdx + 1)
      .replace(/,/g, '')
      .slice(0, 2)
    v = before + ',' + after
  }
  const parts = v.split(',')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return parts.join(',')
}
