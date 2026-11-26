'use client';

import { memo, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Barcode,
  Check,
  FilePlus2,
  FolderPlus,
  Minus,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import type { Material, Section, StockStatus } from '@/lib/types';
import { getStockStatus, type MaterialFilters } from '@/lib/warehouse-logic';
import { FormattedTime } from './FormattedTime';

interface InventoryTableProps {
  materials: Material[];
  sections: Section[];
  operatorCount: number;
  sectionCount: number;
  filters: MaterialFilters;
  loading: boolean;
  busyMaterialId: string | null;
  onChangeFilters: (next: Partial<MaterialFilters>) => void;
  onResetFilters: () => void;
  onQuickDelta: (material: Material, delta: number) => void;
  onOpenAdjust: (material: Material) => void;
  onOpenEdit: (material: Material) => void;
  onSaveInlineEdit: (
    material: Material,
    updates: {
      name: string;
      sectionId: string;
      quantity: number;
      minThreshold: number;
      lotNumber: string;
    }
  ) => Promise<{ ok: boolean; error?: string }>;
  onBulkAction: (payload: {
    ids: string[];
    bulkAction: 'transfer' | 'delete';
    targetSectionId?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onOpenLabel: (material: Material) => void;
  onDelete: (material: Material) => void;
  onOpenAddMaterial: () => void;
  onOpenNewSection: () => void;
  onNavigateOperators: () => void;
  onOpenQuickFile: () => void;
}

const STATUS_TABS: { value: StockStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'nominal', label: 'Nominal' },
  { value: 'low', label: 'Low Stock' },
  { value: 'out', label: 'Out' },
];

export const InventoryTable = memo(function InventoryTable({
  materials,
  sections,
  operatorCount,
  sectionCount,
  filters,
  loading,
  busyMaterialId,
  onChangeFilters,
  onResetFilters,
  onQuickDelta,
  onOpenAdjust,
  onOpenEdit,
  onSaveInlineEdit,
  onBulkAction,
  onOpenLabel,
  onDelete,
  onOpenAddMaterial,
  onOpenNewSection,
  onNavigateOperators,
  onOpenQuickFile,
}: InventoryTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkSectionId, setBulkSectionId] = useState<string>('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const [inlineId, setInlineId] = useState<string | null>(null);
  const [inlineName, setInlineName] = useState('');
  const [inlineSectionId, setInlineSectionId] = useState('');
  const [inlineQty, setInlineQty] = useState('0');
  const [inlineMin, setInlineMin] = useState('0');
  const [inlineLot, setInlineLot] = useState('');
  const [inlineSaving, setInlineSaving] = useState(false);

  const sectionMap = useMemo(
    () => new Map(sections.map((s) => [s.id, s])),
    [sections]
  );

  const visibleIdSet = useMemo(
    () => new Set(materials.map((m) => m.id)),
    [materials]
  );

  const effectiveSelectedIds = useMemo(
    () => selectedIds.filter((id) => visibleIdSet.has(id)),
    [selectedIds, visibleIdSet]
  );

  const allSelected =
    materials.length > 0 && effectiveSelectedIds.length === materials.length;

  const hasActiveFilter =
    filters.query.trim() !== '' || filters.sectionId !== 'all' || filters.status !== 'all';

  const resolvedBulkSectionId =
    bulkSectionId && sections.some((s) => s.id === bulkSectionId)
      ? bulkSectionId
      : (sections[0]?.id ?? '');

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(materials.map((m) => m.id));
    }
  }

  function toggleRowSelection(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function startInlineEdit(item: Material) {
    setInlineError(null);
    setInlineId(item.id);
    setInlineName(item.name);
    setInlineSectionId(item.sectionId);
    setInlineQty(String(item.quantity));
    setInlineMin(String(item.minThreshold));
    setInlineLot(item.lotNumber ?? '');
  }

  async function saveInlineRow(item: Material) {
    setInlineError(null);
    setInlineSaving(true);
    const res = await onSaveInlineEdit(item, {
      name: inlineName,
      sectionId: inlineSectionId,
      quantity: Number(inlineQty),
      minThreshold: Number(inlineMin),
      lotNumber: inlineLot,
    });
    setInlineSaving(false);
    if (!res.ok) {
      setInlineError(res.error ?? 'Could not save inline changes.');
      return;
    }
    setInlineId(null);
  }

  async function runBulk(action: 'transfer' | 'delete') {
    if (effectiveSelectedIds.length === 0) return;
    setInlineError(null);
    setBulkBusy(true);
    const res = await onBulkAction({
      ids: effectiveSelectedIds,
      bulkAction: action,
      targetSectionId: action === 'transfer' ? resolvedBulkSectionId : undefined,
    });
    setBulkBusy(false);
    if (!res.ok) {
      setInlineError(res.error ?? 'Bulk operation failed.');
      return;
    }
    setSelectedIds([]);
  }

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

      {/* Bulk Action Bar */}
      {effectiveSelectedIds.length > 0 && (
        <div className="px-3 py-2 border-b border-blue-200 bg-blue-50/70 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="font-semibold text-blue-950 font-mono tabular-nums">
            {effectiveSelectedIds.length} selected
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {sections.length > 0 && (
              <>
                <label htmlFor="bulk-target-section" className="sr-only">
                  Target section for bulk move
                </label>
                <select
                  id="bulk-target-section"
                  value={resolvedBulkSectionId}
                  onChange={(e) => setBulkSectionId(e.target.value)}
                  className="h-7 px-2 text-xs bg-white border border-blue-200 rounded text-slate-800"
                >
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      Move to {s.code} — {s.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={bulkBusy || !resolvedBulkSectionId}
                  onClick={() => runBulk('transfer')}
                  className="h-7 px-2.5 font-medium text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50 cursor-pointer"
                >
                  Move Selected
                </button>
              </>
            )}
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => runBulk('delete')}
              className="h-7 px-2.5 font-medium text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded disabled:opacity-50 cursor-pointer"
            >
              Delete Selected
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="h-7 px-2 text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {inlineError && (
        <div
          role="alert"
          className="px-3 py-2 border-b border-red-200 bg-red-50 text-xs font-medium text-red-700 flex items-center justify-between gap-2"
        >
          <span>{inlineError}</span>
          <button
            type="button"
            onClick={() => setInlineError(null)}
            className="text-red-800 hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

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
            {hasActiveFilter ? 'No matching materials found' : 'Warehouse workspace is clean'}
          </p>
          <p className="mt-1 text-xs text-slate-500 max-w-lg mx-auto">
            {hasActiveFilter
              ? 'Try clearing your section or search query filters to view all warehouse inventory.'
              : 'All sample data is cleared. Create user accounts, add warehouse sections with tracking prefixes, register materials, or create shared files.'}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {hasActiveFilter ? (
              <button
                type="button"
                onClick={onResetFilters}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
              >
                Reset Filters
              </button>
            ) : (
              <>
                {operatorCount === 0 && (
                  <button
                    type="button"
                    onClick={onNavigateOperators}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                    Add User Account
                  </button>
                )}
                {sectionCount === 0 ? (
                  <button
                    type="button"
                    onClick={onOpenNewSection}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 cursor-pointer"
                  >
                    <FolderPlus className="w-3.5 h-3.5" aria-hidden="true" />
                    Create First Section
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onOpenAddMaterial}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    Add First Material
                  </button>
                )}
                <button
                  type="button"
                  onClick={onOpenQuickFile}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
                >
                  <FilePlus2 className="w-3.5 h-3.5" aria-hidden="true" />
                  Create Shared File
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                <th className="py-2 pl-3 pr-1 w-8">
                  <input
                    type="checkbox"
                    aria-label="Select all visible materials"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-600 cursor-pointer"
                  />
                </th>
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
                const isSelected = effectiveSelectedIds.includes(item.id);
                const isInline = inlineId === item.id;

                return (
                  <tr
                    key={item.id}
                    className={`transition-colors group ${
                      isInline
                        ? 'bg-blue-50/40'
                        : isSelected
                          ? 'bg-blue-50/30 hover:bg-blue-50/50'
                          : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <td className="py-2 pl-3 pr-1">
                      <input
                        type="checkbox"
                        aria-label={`Select ${item.trackingCode}`}
                        checked={isSelected}
                        onChange={() => toggleRowSelection(item.id)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-600 cursor-pointer"
                      />
                    </td>

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

                    {/* Material Name & Lot (inline editable) */}
                    <td className="py-2 px-3 min-w-[200px]">
                      {isInline ? (
                        <div className="space-y-1">
                          <input
                            type="text"
                            aria-label={`Inline name for ${item.trackingCode}`}
                            value={inlineName}
                            onChange={(e) => setInlineName(e.target.value)}
                            className="w-full h-7 px-2 text-xs bg-white border border-blue-400 rounded"
                          />
                          <input
                            type="text"
                            aria-label={`Inline lot for ${item.trackingCode}`}
                            value={inlineLot}
                            onChange={(e) => setInlineLot(e.target.value.toUpperCase())}
                            placeholder="Lot #"
                            className="w-28 h-6 px-1.5 text-[11px] font-mono uppercase bg-white border border-slate-300 rounded"
                          />
                        </div>
                      ) : (
                        <>
                          <div className="font-medium text-slate-900 leading-tight">{item.name}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <span>{item.category}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono">{item.lotNumber || 'No lot'}</span>
                          </div>
                        </>
                      )}
                    </td>

                    {/* Section Code + Name (inline editable) */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      {isInline ? (
                        <select
                          aria-label={`Inline section for ${item.trackingCode}`}
                          value={inlineSectionId}
                          onChange={(e) => setInlineSectionId(e.target.value)}
                          className="h-7 px-2 text-xs bg-white border border-blue-400 rounded max-w-[160px]"
                        >
                          {sections.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.code} — {s.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <>
                          <div className="font-mono font-semibold text-slate-800">
                            {sec?.code ?? 'UNASSIGNED'}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[130px]">
                            {sec?.name ?? 'Unknown section'}
                          </div>
                        </>
                      )}
                    </td>

                    {/* Stock Quantity + Inline Quick Steppers */}
                    <td className="py-2 px-3 whitespace-nowrap text-right">
                      {isInline ? (
                        <div className="inline-flex items-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            aria-label={`Inline quantity for ${item.trackingCode}`}
                            value={inlineQty}
                            onChange={(e) => setInlineQty(e.target.value)}
                            className="w-20 h-7 px-2 text-xs font-mono tabular-nums text-right bg-white border border-blue-400 rounded"
                          />
                          <span className="text-[11px] text-slate-500">{item.unit}</span>
                        </div>
                      ) : (
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
                      )}
                    </td>

                    {/* Semantic Stock Status / Inline Min Threshold */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      {isInline ? (
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-slate-500">Min</span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            aria-label={`Inline min threshold for ${item.trackingCode}`}
                            value={inlineMin}
                            onChange={(e) => setInlineMin(e.target.value)}
                            className="w-16 h-7 px-2 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded"
                          />
                        </div>
                      ) : status === 'out' ? (
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
                      {isInline ? (
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            disabled={inlineSaving}
                            onClick={() => saveInlineRow(item)}
                            aria-label={`Save inline edit for ${item.trackingCode}`}
                            className="px-2 py-1 text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <Check className="w-3 h-3" />
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setInlineId(null);
                              setInlineError(null);
                            }}
                            aria-label={`Cancel inline edit for ${item.trackingCode}`}
                            className="p-1 text-slate-500 hover:bg-slate-100 rounded cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
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
                            onClick={() => startInlineEdit(item)}
                            aria-label={`Inline edit ${item.trackingCode}`}
                            title="Inline edit row"
                            className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded cursor-pointer"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenEdit(item)}
                            aria-label={`Edit ${item.trackingCode}`}
                            title="Full edit modal"
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
                      )}
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
});

