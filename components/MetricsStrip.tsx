'use client';

import type { WarehouseMetrics } from '@/lib/warehouse-logic';

interface MetricsStripProps {
  metrics: WarehouseMetrics;
  activeStatusFilter: 'all' | 'nominal' | 'low' | 'out';
  onFilterAlerts: () => void;
}

export function MetricsStrip({
  metrics,
  activeStatusFilter,
  onFilterAlerts,
}: MetricsStripProps) {
  return (
    <section
      aria-label="Warehouse summary metrics"
      className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden"
    >
      <div className="bg-white px-4 py-2.5 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-slate-500">Tracked SKUs</span>
        <span className="text-lg font-semibold text-slate-900 font-mono tabular-nums">
          {metrics.totalSkus}
        </span>
      </div>

      <div className="bg-white px-4 py-2.5 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-slate-500">Total Units</span>
        <span className="text-lg font-semibold text-slate-900 font-mono tabular-nums">
          {metrics.totalUnits.toLocaleString('en-US')}
        </span>
      </div>

      <div className="bg-white px-4 py-2.5 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-slate-500">Sections</span>
        <span className="text-lg font-semibold text-slate-900 font-mono tabular-nums">
          {metrics.activeSections}
        </span>
      </div>

      <button
        type="button"
        onClick={onFilterAlerts}
        className={`px-4 py-2.5 flex items-baseline justify-between gap-2 text-left transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600 ${
          activeStatusFilter === 'low' || activeStatusFilter === 'out'
            ? 'bg-amber-50'
            : 'bg-white hover:bg-slate-50'
        }`}
      >
        <span className="text-xs font-medium text-slate-500">Restock Alerts</span>
        <span
          className={`text-lg font-semibold font-mono tabular-nums ${
            metrics.alertCount > 0 ? 'text-amber-700' : 'text-emerald-700'
          }`}
        >
          {metrics.alertCount}
        </span>
      </button>
    </section>
  );
}
