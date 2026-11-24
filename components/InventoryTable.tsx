'use client';

import {
  ArrowLeftRight,
  Barcode,
  Minus,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { Material, Section, StockStatus } from '@/lib/types';
import { getStockStatus, type MaterialFilters } from '@/lib/warehouse-logic';
import { FormattedTime } from './FormattedTime';

interface InventoryTableProps {
  materials: Material[];
  sections: Section[];
  filters: MaterialFilters;
  loading: boolean;
  busyMaterialId: string | null;
  onChangeFilters: (next: Partial<MaterialFilters>) => void;
  onResetFilters: () => void;
  onQuickDelta: (material: Material, delta: number) => void;
  onOpenAdjust: (material: Material) => void;
  onOpenEdit: (material: Material) => void;
  onOpenLabel: (material: Material) => void;
  onDelete: (material: Material) => void;
  onOpenAddMaterial: () => void;
}

const STATUS_TABS: { value: StockStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'nominal', label: 'Nominal' },
  { value: 'low', label: 'Low Stock' },
  { value: 'out', label: 'Out' },
];

export function InventoryTable({
  materials,
  sections,
  filters,
  loading,
  busyMaterialId,
  onChangeFilters,
  onResetFilters,
  onQuickDelta,
  onOpenAdjust,
  onOpenEdit,
  onOpenLabel,
  onDelete,
  onOpenAddMaterial,
}: InventoryTableProps) {
  const sectionMap = new Map(sections.map((s) => [s.id, s]));
  const hasActiveFilter =
    filters.query.trim() !== '' || filters.sectionId !== 'all' || filters.status !== 'all';

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      {/* Compact Search & Filter Toolbar */}
      <div className="p-3 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-2.5 bg-slate-50/60">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 min-w-0">
          <div className="relative w-full sm:flex-1 sm:max-w-sm">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <label htmlFor="inventory-search" className="sr-only">
              Search by tracking code, section code, or material name
            </label>
            <input
              id="inventory-search"
              type="text"
              value={filters.query}
              onChange={(e) => onChangeFilters({ query: e.target.value })}
              placeholder="Scan or search tracking code, section, item..."
              className="w-full h-9 pl-8 pr-8 text-xs bg-white border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            />
            {filters.query && (
              <button
                type="button"
                onClick={() => onChangeFilters({ query: '' })}
                aria-label="Clear search query"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md border border-slate-200 overflow-x-auto">
            {STATUS_TABS.map((tab) => {
              const active = filters.status === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => onChangeFilters({ status: tab.value })}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="sort-materials" className="text-xs text-slate-500 whitespace-nowrap">
            Sort
          </label>
          <select
            id="sort-materials"
            value={`${filters.sortBy}:${filters.sortDir}`}
            onChange={(e) => {
              const [sortBy, sortDir] = e.target.value.split(':') as [
                MaterialFilters['sortBy'],
                MaterialFilters['sortDir'],
              ];
              onChangeFilters({ sortBy, sortDir });
            }}
            className="h-9 px-2.5 text-xs bg-white border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="updatedAt:desc">Recently Updated</option>
            <option value="trackingCode:asc">Tracking Code (A–Z)</option>
            <option value="name:asc">Material Name (A–Z)</option>
            <option value="quantity:asc">Quantity (Low–High)</option>
            <option value="quantity:desc">Quantity (High–Low)</option>
          </select>

          {hasActiveFilter && (
            <button
              type="button"
              onClick={onResetFilters}
              className="h-9 px-2.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-md whitespace-nowrap cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Dense Operational Data Grid */}
      {loading ? (
        <div className="divide-y divide-slate-100" aria-busy="true" aria-label="Loading inventory">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-11 px-4 flex items-center justify-between gap-4 animate-pulse">
              <div className="h-3.5 w-28 bg-slate-200 rounded" />
              <div className="h-3.5 w-48 bg-slate-100 rounded" />
              <div className="h-3.5 w-20 bg-slate-100 rounded" />
              <div className="h-3.5 w-16 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      ) : materials.length === 0 ? (
        <div className="py-12 px-4 text-center">
          <p className="text-sm font-semibold text-slate-900">
            {hasActiveFilter ? 'No matching materials found' : 'No tracked materials yet'}
          </p>
          <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
            {hasActiveFilter
              ? 'Try clearing your section or search query filters to view all warehouse inventory.'
              : 'Register your first material with a unique tracking code and section assignment.'}
          </p>
          <div className="mt-4">
            {hasActiveFilter ? (
              <button
                type="button"
                onClick={onResetFilters}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
              >
                Reset Filters
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAddMaterial}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 cursor-pointer"
              >
                Add First Material
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                <th className="py-2 px-3 whitespace-nowrap">Tracking Code</th>
                <th className="py-2 px-3 whitespace-nowrap">Material</th>
                <th className="py-2 px-3 whitespace-nowrap">Section</th>
                <th className="py-2 px-3 whitespace-nowrap text-right">Stock</th>
                <th className="py-2 px-3 whitespace-nowrap">Status</th>
                <th className="py-2 px-3 whitespace-nowrap hidden xl:table-cell">Last Updated</th>
                <th className="py-2 px-3 whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {materials.map((item) => {
                const sec = sectionMap.get(item.sectionId);
                const status = getStockStatus(item.quantity, item.minThreshold);
                const isBusy = busyMaterialId === item.id;

                return (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    {/* Tracking Code */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-semibold text-slate-900">
                          {item.trackingCode}
                        </span>
                        <button
                          type="button"
                          onClick={() => onOpenLabel(item)}
                          aria-label={`View tracking label for ${item.trackingCode}`}
                          title="View tracking barcode label"
                          className="p-1 text-slate-400 hover:text-blue-600 rounded focus-visible:outline-2 focus-visible:outline-blue-600 cursor-pointer"
                        >
                          <Barcode className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* Material Name & Unboxed Metadata */}
                    <td className="py-2 px-3 min-w-[200px]">
                      <div className="font-medium text-slate-900 leading-tight">{item.name}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <span>{item.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{item.lotNumber || 'No lot'}</span>
                      </div>
                    </td>

                    {/* Section Code + Name */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      <div className="font-mono font-semibold text-slate-800">
                        {sec?.code ?? 'UNASSIGNED'}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[130px]">
                        {sec?.name ?? 'Unknown section'}
                      </div>
                    </td>

                    {/* Stock Quantity + Inline Quick Steppers */}
                    <td className="py-2 px-3 whitespace-nowrap text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          disabled={isBusy || item.quantity <= 0}
                          onClick={() => onQuickDelta(item, -1)}
                          aria-label={`Decrease stock for ${item.trackingCode}`}
                          className="w-6 h-6 inline-flex items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-mono tabular-nums font-semibold text-slate-900 w-20 text-center truncate">
                          {item.quantity}{' '}
                          <span className="font-sans font-normal text-slate-500 text-[11px]">
                            {item.unit}
                          </span>
                        </span>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => onQuickDelta(item, 1)}
                          aria-label={`Increase stock for ${item.trackingCode}`}
                          className="w-6 h-6 inline-flex items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </td>

                    {/* Semantic Stock Status (unboxed text, zero-pill) */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      {status === 'out' ? (
                        <span className="font-semibold text-red-700">
                          Out of Stock
                        </span>
                      ) : status === 'low' ? (
                        <span className="font-semibold text-amber-700">
                          Low Stock · min {item.minThreshold}
                        </span>
                      ) : (
                        <span className="font-medium text-emerald-700">
                          Nominal
                        </span>
                      )}
                    </td>

                    {/* Updated Attribution */}
                    <td className="py-2 px-3 whitespace-nowrap hidden xl:table-cell text-slate-500">
                      <div className="text-slate-700">{item.updatedBy}</div>
                      <div className="font-mono tabular-nums text-[11px]">
                        <FormattedTime iso={item.updatedAt} mode="time" />
                      </div>
                    </td>

                    {/* Row Actions */}
                    <td className="py-2 px-3 whitespace-nowrap text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onOpenAdjust(item)}
                          aria-label={`Adjust or transfer ${item.trackingCode}`}
                          className="px-2 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200/80 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <ArrowLeftRight className="w-3 h-3" aria-hidden="true" />
                          Move
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenEdit(item)}
                          aria-label={`Edit ${item.trackingCode}`}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(item)}
                          aria-label={`Delete ${item.trackingCode}`}
                          className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
