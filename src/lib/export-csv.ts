const SERVICO_FIELDS = [
  'id',
  'id_servico',
  'data_servico',
  'especialista',
  'tipo_video',
  'identificacao',
  'video_bruto',
  'video_editado',
  'valores',
  'observacoes',
  'editor',
  'mes_faturamento',
  'created',
  'updated',
] as const

function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function exportServicosToCSV(
  records: Record<string, unknown>[],
  filename = 'servicos_export.csv',
): void {
  const header = SERVICO_FIELDS.join(';')
  const rows = records.map((record) =>
    SERVICO_FIELDS.map((field) => escapeCSVValue(record[field])).join(';'),
  )
  const csvContent = [header, ...rows].join('\r\n')
  const bom = '\uFEFF'
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
