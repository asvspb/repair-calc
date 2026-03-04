import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Trash2 } from 'lucide-react';
import type { WorkTemplate, WorkTemplateCategory } from '../../types/workTemplate';
import { CATEGORY_LABELS as BASE_CATEGORY_LABELS } from '../../types/workTemplate';
import type { WorkData } from '../../types';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (work: WorkData) => void;
  templates: WorkTemplate[];
  onLoadTemplate: (template: WorkTemplate, metrics?: { floorArea: number; netWallArea: number; skirtingLength: number }) => WorkData;
  onDeleteTemplate: (id: string) => void;
  roomMetrics?: { floorArea: number; netWallArea: number; skirtingLength: number };
};

// Расширяем базовые метки категорий опцией "all"
const CATEGORY_LABELS: Record<WorkTemplateCategory | 'all', string> = {
  ...BASE_CATEGORY_LABELS,
  all: 'Все',
};

export function WorkTemplatePickerModal({
  isOpen,
  onClose,
  onSelect,
  templates,
  onLoadTemplate,
  onDeleteTemplate,
  roomMetrics,
}: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<WorkTemplateCategory | 'all'>('all');

  // Reset search when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedCategory('all');
    }
  }, [isOpen]);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    let result = templates;

    // Filter by category
    if (selectedCategory !== 'all') {
      result = result.filter(t => t.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t => t.name.toLowerCase().includes(query));
    }

    return result;
  }, [templates, selectedCategory, searchQuery]);

  // Sort templates by name
  const sortedTemplates = useMemo(() => {
    return [...filteredTemplates].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [filteredTemplates]);

  const handleSelect = (template: WorkTemplate) => {
    const work = onLoadTemplate(template, roomMetrics);
    onSelect(work);
    onClose();
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Удалить этот шаблон?')) {
      onDeleteTemplate(id);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Шаблоны работ</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Search and Filters */}
        <div className="p-4 border-b space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск по названию..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>

          {/* Category filters */}
          <div className="flex flex-wrap gap-2">
            {(Object.keys(CATEGORY_LABELS) as (WorkTemplateCategory | 'all')[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        {/* Templates list */}
        <div className="flex-1 overflow-y-auto p-4">
          {sortedTemplates.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">
                {templates.length === 0
                  ? 'Нет сохранённых шаблонов. Сохраните работу как шаблон из списка работ.'
                  : 'Шаблоны не найдены'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedTemplates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => handleSelect(template)}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-indigo-50 cursor-pointer transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800 truncate">{template.name}</span>
                      <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded">
                        {CATEGORY_LABELS[template.category]}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {template.unit} • {template.workUnitPrice.toLocaleString('ru-RU')} ₽/{template.unit}
                      {template.materials.length > 0 && (
                        <span className="ml-2">• {template.materials.length} материалов</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, template.id)}
                    className="p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                    title="Удалить шаблон"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 rounded-b-xl">
          <p className="text-sm text-gray-500 text-center">
            Всего шаблонов: {templates.length}
          </p>
        </div>
      </div>
    </div>
  );
}