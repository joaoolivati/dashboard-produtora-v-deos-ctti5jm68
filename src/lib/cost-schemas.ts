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

export const rbt12Schema = z.object({
  rbt12: z.number().min(0, 'RBT12 deve ser maior ou igual a zero'),
  nominalRate: z
    .number()
    .min(0, 'Alíquota deve ser maior ou igual a zero')
    .max(100, 'Alíquota máxima é 100'),
  deduction: z.number().min(0, 'Dedução deve ser maior ou igual a zero'),
})

export const effectiveRateSchema = z.object({
  percentage: z
    .number()
    .min(0, 'A alíquota deve ser maior ou igual a zero')
    .max(100, 'A alíquota deve ser menor ou igual a 100'),
})

export type CostItemInput = z.infer<typeof costItemSchema>
export type TaxPercentageInput = z.infer<typeof taxPercentageSchema>
export type Rbt12Input = z.infer<typeof rbt12Schema>
export type EffectiveRateInput = z.infer<typeof effectiveRateSchema>
