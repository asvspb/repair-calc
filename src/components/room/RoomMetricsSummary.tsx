import type { RoomMetrics } from '../../types';

interface RoomMetricsSummaryProps {
  metrics: RoomMetrics;
  total: number;
}

export function RoomMetricsSummary({ metrics, total }: RoomMetricsSummaryProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <div
        className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center"
        data-testid="metric-floor-area"
      >
        <div className="text-sm text-gray-500 mb-1">Площадь пола</div>
        <div className="text-xl font-light">
          {metrics.floorArea.toFixed(2)} <span className="text-sm text-gray-400">м²</span>
        </div>
      </div>
      <div
        className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center"
        data-testid="metric-wall-area"
      >
        <div className="text-sm text-gray-500 mb-1">Площадь стен</div>
        <div className="text-xl font-light">
          {metrics.netWallArea.toFixed(2)} <span className="text-sm text-gray-400">м²</span>
        </div>
      </div>
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center">
        <div className="text-sm text-gray-500 mb-1">Периметр/Плинтус</div>
        <div className="flex items-baseline gap-2">
          <div className="flex flex-col items-center">
            <div className="text-xl font-light">{metrics.perimeter.toFixed(2)}</div>
            <div className="w-10 border-t border-gray-200 my-1" />
            <div className="text-xl font-light">{metrics.skirtingLength.toFixed(2)}</div>
          </div>
          <span className="text-sm text-gray-400">м</span>
        </div>
      </div>
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center">
        <div className="text-sm text-gray-500 mb-1">Объем</div>
        <div className="text-xl font-light">
          {metrics.volume?.toFixed(2) || '0.00'} <span className="text-sm text-gray-400">м³</span>
        </div>
      </div>
      <div
        data-testid="room-cost-card"
        className="bg-indigo-50 p-5 rounded-2xl shadow-sm border border-indigo-100 flex flex-col justify-center items-center text-center"
      >
        <div className="text-sm text-indigo-600 mb-1">Стоимость, ₽</div>
        <div data-testid="room-cost-value" className="text-xl font-semibold text-indigo-900">
          {Math.ceil(total).toLocaleString('ru-RU')} <span className="text-sm text-indigo-400" />
        </div>
      </div>
    </div>
  );
}
