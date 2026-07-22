import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'

interface CurrencyInputProps {
  value: number
  onChange: (value: number) => void
  className?: string
  placeholder?: string
}

function formatBRL(num: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

export function CurrencyInput({ value, onChange, className, placeholder }: CurrencyInputProps) {
  const [display, setDisplay] = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!focused) {
      setDisplay(value !== 0 ? `R$ ${formatBRL(value)}` : '')
    }
  }, [value, focused])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let stripped = e.target.value.replace(/R\$\s?/g, '').replace(/\./g, '')
    const commaIdx = stripped.indexOf(',')
    if (commaIdx !== -1) {
      const before = stripped.slice(0, commaIdx)
      const after = stripped
        .slice(commaIdx + 1)
        .replace(/,/g, '')
        .slice(0, 2)
      stripped = before + ',' + after
    }
    const [intStr, decStr] = stripped.split(',')
    const intNum = parseInt(intStr || '0') || 0
    const num = decStr !== undefined ? parseFloat(`${intNum}.${decStr}`) : intNum

    let formatted: string
    if (stripped === '' || stripped === '0') {
      formatted = ''
    } else {
      const intDisplay = intNum > 0 ? intNum.toLocaleString('pt-BR') : '0'
      formatted = decStr !== undefined ? `R$ ${intDisplay},${decStr}` : `R$ ${intDisplay}`
    }
    setDisplay(formatted)
    onChange(num)
  }

  const handleFocus = () => {
    setFocused(true)
    if (value !== 0) {
      const intNum = Math.floor(value)
      const decNum = Math.round((value - intNum) * 100)
      setDisplay(`R$ ${intNum.toLocaleString('pt-BR')},${String(decNum).padStart(2, '0')}`)
    } else {
      setDisplay('')
    }
  }

  const handleBlur = () => {
    setFocused(false)
    setDisplay(value !== 0 ? `R$ ${formatBRL(value)}` : '')
  }

  return (
    <Input
      ref={inputRef}
      value={display}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={className}
      placeholder={placeholder || 'R$ 0,00'}
      inputMode="decimal"
    />
  )
}
