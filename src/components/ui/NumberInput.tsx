import React, { useState, useEffect, ChangeEvent, memo } from 'react';

type NumberInputProps = {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  min?: number;
  step?: number;
};

const NumberInputInternal: React.FC<NumberInputProps> = ({
  value,
  onChange,
  className = '',
  min = 0,
  step = 1,
}) => {
  const [str, setStr] = useState(value.toString());
  const isTypingRef = React.useRef(false);

  useEffect(() => {
    // Синхронизируем с внешним value только если пользователь не вводит данные
    if (!isTypingRef.current) {
      setStr(value.toString());
    }
  }, [value]);

  const handleFocus = () => {
    isTypingRef.current = true;
  };

  const handleBlur = () => {
    isTypingRef.current = false;
    // При потере фокуса синхронизируем с value
    setStr(value.toString());
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setStr(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) {
      onChange(parsed);
    } else if (val === '') {
      onChange(0);
    }
  };

  return (
    <input
      type="number"
      min={min}
      step={step}
      value={str}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={`px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-text [&::-webkit-inner-spin-button]:cursor-pointer [&::-webkit-outer-spin-button]:cursor-pointer [&::-webkit-inner-spin-button]:hover:bg-indigo-50 [&::-webkit-outer-spin-button]:hover:bg-indigo-50 ${className}`}
    />
  );
};

/**
 * Экспортируемый компонент с мемоизацией.
 * Сравниваем value и className для оптимизации.
 * onChange не сравниваем, так как обычно это стабильная функция из родителя.
 */
export const NumberInput = memo(NumberInputInternal, (prevProps, nextProps) => {
  return (
    prevProps.value === nextProps.value &&
    prevProps.className === nextProps.className &&
    prevProps.min === nextProps.min &&
    prevProps.step === nextProps.step
  );
});
