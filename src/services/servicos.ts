import pb from '@/lib/pocketbase/client'

export interface ServicoRecord {
  id: string
  data_servico: string
  especialista: string
  tipo_video: string
  identificacao: string
  video_bruto: string
  video_editado: string
  valores: number
  observacoes: string
  editor: string
  mes_faturamento: string
  created: string
  updated: string
}

export const getServicos = async (): Promise<ServicoRecord[]> => {
  return await pb.collection('servicos').getFullList<ServicoRecord>({
    sort: '-data_servico',
  })
}

export const createServico = async (data: Partial<ServicoRecord>) => {
  return await pb.collection('servicos').create(data)
}

export const updateServico = async (id: string, data: Partial<ServicoRecord>) => {
  return await pb.collection('servicos').update(id, data)
}

export const deleteServico = async (id: string) => {
  return await pb.collection('servicos').delete(id)
}
