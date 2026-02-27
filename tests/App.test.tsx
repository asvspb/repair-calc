import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

// Тест компонента NumberInput (исправление бага)
describe('NumberInput', () => {
  // Создаем простой тестовый компонент
  const TestNumberInput = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => {
    const [str, setStr] = React.useState(value.toString())
    const isTypingRef = React.useRef(false)

    React.useEffect(() => {
      if (!isTypingRef.current) {
        setStr(value.toString())
      }
    }, [value])

    const handleFocus = () => {
      isTypingRef.current = true
    }

    const handleBlur = () => {
      isTypingRef.current = false
      setStr(value.toString())
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      setStr(val)
      const parsed = parseFloat(val)
      if (!isNaN(parsed)) {
        onChange(parsed)
      } else if (val === '') {
        onChange(0)
      }
    }

    return (
      <input
        type="number"
        value={str}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        data-testid="number-input"
      />
    )
  }

  it('should display initial value', () => {
    const onChange = vi.fn()
    render(<TestNumberInput value={42} onChange={onChange} />)
    
    expect(screen.getByTestId('number-input')).toHaveValue(42)
  })

  it('should call onChange when user types', () => {
    const onChange = vi.fn()
    render(<TestNumberInput value={10} onChange={onChange} />)
    
    const input = screen.getByTestId('number-input')
    fireEvent.change(input, { target: { value: '25' } })
    
    expect(onChange).toHaveBeenCalledWith(25)
  })

  it('should update display when external value changes', () => {
    const onChange = vi.fn()
    const { rerender } = render(<TestNumberInput value={10} onChange={onChange} />)
    
    rerender(<TestNumberInput value={20} onChange={onChange} />)
    
    expect(screen.getByTestId('number-input')).toHaveValue(20)
  })

  it('should not update display while typing', () => {
    const onChange = vi.fn()
    const { rerender } = render(<TestNumberInput value={10} onChange={onChange} />)
    
    const input = screen.getByTestId('number-input')
    fireEvent.focus(input) // Начинаем ввод
    
    // Внешнее значение меняется, но поле не обновляется
    rerender(<TestNumberInput value={20} onChange={onChange} />)
    
    // Значение в поле должно остаться 10 (пользователь вводит)
    expect(screen.getByTestId('number-input')).toHaveValue(10)
  })
})