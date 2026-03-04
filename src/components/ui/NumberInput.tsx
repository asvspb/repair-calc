import React, { useState, useEffect, ChangeEvent } from 'react';

type NumberInputProps = {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  min?: number;
  step?: number;
};

export function NumberInput({ value, onChange, className = '', min = 0, step = 1 }: NumberInputProps) {
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
}