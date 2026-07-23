import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { getServicos } from '@/services/servicos'
import { exportServicosToCSV } from '@/lib/export-csv'

export function ExportCsvButton() {
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const records = await getServicos()
      if (!records || records.length === 0) {
        toast({
          title: 'Aviso',
          description: 'Não há registros para exportar.',
          variant: 'destructive',
        })
        return
      }
      exportServicosToCSV(records)
      toast({
        title: 'Exportação concluída',
        description: `${records.length} registros exportados com sucesso.`,
      })
    } catch {
      toast({
        title: 'Erro na exportação',
        description: 'Falha ao buscar os dados. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setExporting(false)
    }
  }

  return (
    <Button onClick={handleExport} disabled={exporting} className="gap-2">
      {exporting ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Exportando...
        </>
      ) : (
        <>
          <Download className="h-4 w-4" />
          Exportar CSV
        </>
      )}
    </Button>
  )
}
