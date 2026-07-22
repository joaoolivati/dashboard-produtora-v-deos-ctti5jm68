import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface CurrencyInputProps {
  value: number
  onChange: (value: number) => void
  className?: string
  placeholder?: string
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function CurrencyInput({ value, onChange, className, placeholder }: CurrencyInputProps) {
  const [display, setDisplay] = useState('')
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) {
      setDisplay(value > 0 ? `R$ ${formatBRL(value)}` : '')
    }
  }, [value, focused])

  const handleFocus = () => {
    setFocused(true)
    if (value > 0) {
      setDisplay(value.toFixed(2).replace('.', ','))
    } else {
      setDisplay('')
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value
    val = val.replace(/R\$\s?/g, '')
    val = val.replace(/[^\d,]/g, '')

    const commaIdx = val.indexOf(',')
    if (commaIdx !== -1) {
      const before = val.slice(0, commaIdx)
      const after = val.slice(commaIdx + 1).replace(/,/g, '')
      const intPart = before.replace(/^0+/, '') || '0'
      val = `${intPart},${after}`
    } else {
      val = val.replace(/^0+/, '') || ''
    }

    setDisplay(val)

    const numStr = val.replace(',', '.')
    const num = numStr ? parseFloat(numStr) : 0
    onChange(isNaN(num) ? 0 : num)
  }

  const handleBlur = () => {
    setFocused(false)
    const numStr = display.replace(',', '.')
    const num = numStr ? parseFloat(numStr) : 0
    const rounded = Math.round((num + Number.EPSILON) * 100) / 100
    setDisplay(rounded > 0 ? `R$ ${formatBRL(rounded)}` : '')
    if (rounded !== value) {
      onChange(rounded)
    }
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder || 'R$ 0,00'}
      className={cn('font-mono', className)}
    />
  )
}
