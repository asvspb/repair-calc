/**
 * MaterialPriceSearch - кнопка и модальное окно для поиска цен через Gemini AI
 */

import React, { memo, useState, useCallback } from 'react';
import { Search, Loader2, AlertCircle, Check, RefreshCw } from 'lucide-react';
import { useGeminiPriceSearch, isGeminiConfigured } from '../../api/prices';
import type { PriceSearchResult, PriceSearchError } from '../../api/prices';

type Props = {
  materialName: string;
  city?: string;
  onPriceFound: (price: number) => void;
  disabled?: boolean;
};

/**
 * Компонент для поиска цены материала
 */
const MaterialPriceSearchInternal: React.FC<Props> = ({
  materialName,
  city = 'Москва',
  onPriceFound,
  disabled = false,
}) => {
  const [showModal, setShowModal] = useState(false);
  const { search, isLoading, result, error, reset, isConfigured } = useGeminiPriceSearch();

  // Обработчик поиска
  const handleSearch = useCallback(() => {
    if (!materialName.trim()) return;
    
    search({
      productName: materialName,
      city,
    });
  }, [materialName, city, search]);

  // Обработчик применения цены
  const handleApplyPrice = (price: number) => {
    onPriceFound(price);
    setShowModal(false);
    reset();
  };

  // Если API не настроен — не показываем кнопку
  if (!isConfigured) {
    return null;
  }

  return (
    <>
      {/* Кнопка поиска */}
      <button
        onClick={() => {
          setShowModal(true);
          handleSearch();
        }}
        disabled={disabled || !materialName.trim()}
        className="p-1 text-gray-400 hover:text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        title="Найти цену в интернете"
      >
        <Search className="w-4 h-4" />
      </button>

      {/* Модальное окно с результатами */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-scale-in">
            {/* Заголовок */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Search className="w-5 h-5 text-indigo-600" />
                Поиск цен
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  reset();
                }}
                className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* Что ищем */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500">Поиск цен на:</div>
              <div className="font-medium">{materialName}</div>
              <div className="text-sm text-gray-500">Город: {city}</div>
            </div>

            {/* Загрузка */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                <p className="mt-2 text-sm text-gray-500">
                  Gemini ищет цены...
                </p>
              </div>
            )}

            {/* Ошибка */}
            {error && !isLoading && (
              <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                <div className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-medium">Ошибка</span>
                </div>
                <p className="mt-1 text-sm text-red-600">{error.message}</p>
                {error.retryable && (
                  <button
                    onClick={handleSearch}
                    className="mt-2 flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Повторить
                  </button>
                )}
              </div>
            )}

            {/* Результат */}
            {result && !isLoading && !error && (
              <div className="space-y-4">
                {/* Диапазон цен */}
                <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-indigo-900">
                      {Math.round(result.prices.avg).toLocaleString('ru-RU')} ₽
                    </div>
                    <div className="text-sm text-indigo-600">
                      средняя цена
                    </div>
                    <div className="mt-2 flex justify-center gap-4 text-sm">
                      <span className="text-gray-500">
                        от {Math.round(result.prices.min).toLocaleString('ru-RU')} ₽
                      </span>
                      <span className="text-gray-500">
                        до {Math.round(result.prices.max).toLocaleString('ru-RU')} ₽
                      </span>
                    </div>
                  </div>
                </div>

                {/* Источники */}
                {result.sources.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Источники:</div>
                    <div className="flex flex-wrap gap-1">
                      {result.sources.map((source, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-0.5 bg-gray-100 rounded"
                        >
                          {source}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Уверенность */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500">Точность:</span>
                  <span
                    className={`px-2 py-0.5 rounded ${
                      result.confidence === 'high'
                        ? 'bg-green-100 text-green-700'
                        : result.confidence === 'medium'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {result.confidence === 'high'
                      ? 'Высокая'
                      : result.confidence === 'medium'
                      ? 'Средняя'
                      : 'Низкая'}
                  </span>
                </div>

                {/* Предупреждение */}
                {result.disclaimer && (
                  <p className="text-xs text-gray-500 italic">
                    ⚠️ {result.disclaimer}
                  </p>
                )}

                {/* Кнопки действий */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => handleApplyPrice(result.prices.avg)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    Использовать среднюю
                  </button>
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 cursor-pointer"
                  >
                    Отмена
                  </button>
                </div>

                {/* Альтернативные цены */}
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => handleApplyPrice(result.prices.min)}
                    className="flex-1 py-1.5 text-sm bg-gray-50 text-gray-600 rounded hover:bg-gray-100 cursor-pointer"
                  >
                    Мин: {Math.round(result.prices.min).toLocaleString('ru-RU')} ₽
                  </button>
                  <button
                    onClick={() => handleApplyPrice(result.prices.max)}
                    className="flex-1 py-1.5 text-sm bg-gray-50 text-gray-600 rounded hover:bg-gray-100 cursor-pointer"
                  >
                    Макс: {Math.round(result.prices.max).toLocaleString('ru-RU')} ₽
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export const MaterialPriceSearch = memo(MaterialPriceSearchInternal);