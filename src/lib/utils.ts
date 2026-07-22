import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value)
}

export function formatRate(rate: number): string {
  if (rate === 0) return '0,00'
  const fixed = rate.toFixed(5)
  let trimmed = fixed.replace(/0+$/, '')
  if (trimmed.endsWith('.')) trimmed = trimmed.slice(0, -1)
  const parts = trimmed.split('.')
  if (parts.length < 2) return `${parts[0]},00`
  if (parts[1].length < 2) return `${parts[0]},${parts[1]}0`
  return trimmed.replace('.', ',')
}
