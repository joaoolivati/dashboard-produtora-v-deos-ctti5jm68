import pb from '@/lib/pocketbase/client'

export interface ServicoRecord {
  id: string
  identificacao: string
  descricao: string
  categoria: string
  status: string
  cliente: string
  data_entrega: string
  valor: number
  created: string
  updated: string
}

export const getServicos = async (): Promise<ServicoRecord[]> => {
  return await pb.collection('servicos').getFullList<ServicoRecord>({
    sort: '-data_entrega',
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
