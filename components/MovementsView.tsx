'use client';

import { useState } from 'react';
import type { Movement, MovementType } from '@/lib/types';
import { FormattedTime } from './FormattedTime';

interface MovementsViewProps {
  movements: Movement[];
}

const FILTER_OPTIONS: { value: MovementType | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All Events' },
  { value: 'INBOUND', label: 'Inbound' },
  { value: 'OUTBOUND', label: 'Outbound' },
  { value: 'TRANSFER', label: 'Transfers' },
  { value: 'ADJUST', label: 'Adjustments' },
  { value: 'CREATED', label: 'New SKUs' },
];

export function MovementsView({ movements }: MovementsViewProps) {
  const [typeFilter, setTypeFilter] = useState<MovementType | 'ALL'>('ALL');

  const visible =
    typeFilter === 'ALL'
      ? movements
      : movements.filter((m) => m.type === typeFilter);

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <h1 className="text-base font-semibold text-slate-900">Real-Time Movement Ledger</h1>
          <p className="text-xs text-slate-500">
            Live audit trail attributing every inventory change to its operator and section code.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md border border-slate-200 overflow-x-auto">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTypeFilter(opt.value)}
              className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap shrink-0 cursor-pointer ${
                typeFilter === opt.value
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {visible.length === 0 ? (
          <div className="py-10 px-4 text-center text-xs text-slate-500">
            No movement records match this filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                  <th className="py-2 px-3 whitespace-nowrap">Timestamp</th>
                  <th className="py-2 px-3 whitespace-nowrap">Event</th>
                  <th className="py-2 px-3 whitespace-nowrap">Tracking Code</th>
                  <th className="py-2 px-3 whitespace-nowrap">Material</th>
                  <th className="py-2 px-3 whitespace-nowrap">Section</th>
                  <th className="py-2 px-3 whitespace-nowrap text-right">Delta</th>
                  <th className="py-2 px-3 whitespace-nowrap text-right">Balance</th>
                  <th className="py-2 px-3 whitespace-nowrap">Operator</th>
                  <th className="py-2 px-3 whitespace-nowrap">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {visible.map((mov) => (
                  <tr key={mov.id} className="hover:bg-slate-50/80">
                    <td className="py-2 px-3 whitespace-nowrap font-mono tabular-nums text-[11px] text-slate-500">
                      <FormattedTime iso={mov.timestamp} mode="datetime" />
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap font-semibold text-slate-700">
                      {mov.type}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap font-mono font-semibold text-slate-900">
                      {mov.trackingCode}
                    </td>
                    <td className="py-2 px-3 min-w-[160px] text-slate-800">
                      {mov.materialName}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap font-mono text-slate-700">
                      {mov.previousSectionCode
                        ? `${mov.previousSectionCode} -> ${mov.sectionCode}`
                        : mov.sectionCode}
                    </td>
                    <td
                      className={`py-2 px-3 whitespace-nowrap text-right font-mono tabular-nums font-semibold ${
                        mov.delta > 0
                          ? 'text-emerald-700'
                          : mov.delta < 0
                            ? 'text-amber-700'
                            : 'text-slate-500'
                      }`}
                    >
                      {mov.delta > 0 ? `+${mov.delta}` : mov.delta}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap text-right font-mono tabular-nums text-slate-900">
                      {mov.newQuantity}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className="font-medium text-slate-800">{mov.operatorName}</span>
                      <span className="text-slate-400"> · {mov.operatorRole}</span>
                    </td>
                    <td className="py-2 px-3 text-slate-500 max-w-xs truncate">
                      {mov.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
