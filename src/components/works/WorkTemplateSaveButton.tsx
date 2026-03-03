import React, { useState } from 'react';
import { Save, Check, X } from 'lucide-react';
import type { WorkData } from '../../App';

type Props = {
  work: WorkData;
  onSave: (work: WorkData, forceReplace: boolean) => { success: boolean; error?: string; needsConfirm?: boolean };
  className?: string;
};

export function WorkTemplateSaveButton({ work, onSave, className = '' }: Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleClick = () => {
    if (showConfirm) return;
    
    const result = onSave(work, false);
    
    if (result.success) {
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } else if (result.needsConfirm) {
      setShowConfirm(true);
    }
  };

  const handleConfirm = (confirm: boolean) => {
    if (confirm) {
      const result = onSave(work, true);
      if (result.success) {
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
      }
    }
    setShowConfirm(false);
  };

  if (isSaved) {
    return (
      <span className={`flex items-center gap-1 text-xs text-emerald-600 ${className}`}>
        <Check className="w-3 h-3" />
        Шаблон сохранён
      </span>
    );
  }

  if (showConfirm) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="text-xs text-gray-500">Заменить?</span>
        <button
          onClick={() => handleConfirm(true)}
          className="text-xs text-indigo-600 font-medium hover:text-indigo-700 cursor-pointer"
        >
          Да
        </button>
        <button
          onClick={() => handleConfirm(false)}
          className="text-xs text-gray-400 font-medium hover:text-gray-600 cursor-pointer"
        >
          Нет
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-600 transition-colors cursor-pointer ${className}`}
      title="Сохранить как шаблон"
    >
      <Save className="w-3 h-3" />
      Сохранить как шаблон
    </button>
  );
}