import { z } from 'zod'

export const costItemSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
  amount: z.number().min(0, 'Valor deve ser maior ou igual a zero'),
})

export const taxPercentageSchema = z.object({
  percentage: z
    .number()
    .min(0, 'Percentual deve ser maior ou igual a zero')
    .max(100, 'Percentual máximo é 100'),
})

export type CostItemInput = z.infer<typeof costItemSchema>
export type TaxPercentageInput = z.infer<typeof taxPercentageSchema>
