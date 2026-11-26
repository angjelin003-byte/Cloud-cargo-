'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import type { Material, Section } from '@/lib/types';
import { generateTrackingCode, normalizeCode } from '@/lib/warehouse-logic';

interface MaterialModalProps {
  editingMaterial: Material | null;
  sections: Section[];
  existingMaterials: Material[];
  defaultSectionId?: string;
  onClose: () => void;
  onOpenNewSection?: () => void;
  onSubmit: (payload: {
    id?: string;
    trackingCode: string;
    name: string;
    category: string;
    sectionId: string;
    quantity: number;
    unit: string;
    minThreshold: number;
    lotNumber: string;
  }) => Promise<{ ok: boolean; error?: string }>;
}

export function MaterialModal({
  editingMaterial,
  sections,
  existingMaterials,
  defaultSectionId,
  onClose,
  onOpenNewSection,
  onSubmit,
}: MaterialModalProps) {
  const initialSectionId = editingMaterial
    ? editingMaterial.sectionId
    : defaultSectionId && sections.some((s) => s.id === defaultSectionId)
      ? defaultSectionId
      : (sections[0]?.id ?? '');

  const initialSec = sections.find((s) => s.id === initialSectionId);

  const [name, setName] = useState(editingMaterial?.name ?? '');
  const [category, setCategory] = useState(editingMaterial?.category ?? 'Metals');
  const [sectionId, setSectionId] = useState(initialSectionId);
  const [trackingCode, setTrackingCode] = useState(() =>
    editingMaterial
      ? editingMaterial.trackingCode
      : initialSec
        ? generateTrackingCode(initialSec.code, 'Material', existingMaterials)
        : ''
  );
  const [quantity, setQuantity] = useState(
    editingMaterial ? String(editingMaterial.quantity) : '0'
  );
  const [unit, setUnit] = useState(editingMaterial?.unit ?? 'pcs');
  const [minThreshold, setMinThreshold] = useState(
    editingMaterial ? String(editingMaterial.minThreshold) : '10'
  );
  const [lotNumber, setLotNumber] = useState(editingMaterial?.lotNumber ?? '');
  const [codeEditedManually, setCodeEditedManually] = useState(
    Boolean(editingMaterial)
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function regenerateCode(nextSectionId: string, nextName: string) {
    const sec = sections.find((s) => s.id === nextSectionId);
    if (!sec) return;
    setTrackingCode(
      generateTrackingCode(sec.code, nextName || 'Material', existingMaterials)
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await onSubmit({
      id: editingMaterial?.id,
      trackingCode: normalizeCode(trackingCode),
      name,
      category,
      sectionId,
      quantity: Number(quantity),
      unit,
      minThreshold: Number(minThreshold),
      lotNumber,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not save material.');
      return;
    }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="material-modal-title"
    >
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 id="material-modal-title" className="text-sm font-semibold text-slate-900">
            {editingMaterial ? `Edit ${editingMaterial.trackingCode}` : 'Register Tracked Material'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close material dialog"
            className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {sections.length === 0 && (
            <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-md flex items-center justify-between gap-2 text-xs text-amber-900">
              <span>Create at least one warehouse section before adding a material.</span>
              {onOpenNewSection && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenNewSection();
                  }}
                  className="px-2.5 py-1 font-semibold bg-white border border-amber-300 rounded hover:bg-amber-100 shrink-0 cursor-pointer"
                >
                  New Section
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="mat-section" className="block text-xs font-medium text-slate-700 mb-1">
                Warehouse Section
              </label>
              <select
                id="mat-section"
                required
                value={sectionId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setSectionId(nextId);
                  if (!codeEditedManually && !editingMaterial) {
                    regenerateCode(nextId, name);
                  }
                }}
                className="w-full h-9 px-2.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="mat-code" className="block text-xs font-medium text-slate-700 mb-1">
                Unique Tracking Code
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  id="mat-code"
                  type="text"
                  required
                  value={trackingCode}
                  onChange={(e) => {
                    setCodeEditedManually(true);
                    setTrackingCode(e.target.value.toUpperCase());
                  }}
                  placeholder="A01-MAT-001"
                  className="w-full h-9 px-2.5 text-xs font-mono uppercase bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <button
                  type="button"
                  onClick={() => {
                    setCodeEditedManually(false);
                    regenerateCode(sectionId, name);
                  }}
                  aria-label="Auto-generate unique tracking code"
                  title="Generate tracking code"
                  className="h-9 w-9 shrink-0 inline-flex items-center justify-center border border-slate-200 rounded-md text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="mat-name" className="block text-xs font-medium text-slate-700 mb-1">
              Material Name
            </label>
            <input
              id="mat-name"
              type="text"
              required
              value={name}
              onChange={(e) => {
                const nextName = e.target.value;
                setName(nextName);
                if (!codeEditedManually && !editingMaterial) {
                  regenerateCode(sectionId, nextName);
                }
              }}
              placeholder="e.g. Copper Busbar 10x50mm"
              className="w-full h-9 px-2.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="mat-category" className="block text-xs font-medium text-slate-700 mb-1">
                Category
              </label>
              <input
                id="mat-category"
                type="text"
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Electrical, Metals"
                className="w-full h-9 px-2.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label htmlFor="mat-lot" className="block text-xs font-medium text-slate-700 mb-1">
                Lot / Batch Number
              </label>
              <input
                id="mat-lot"
                type="text"
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value.toUpperCase())}
                placeholder="Optional (e.g. LOT-2611)"
                className="w-full h-9 px-2.5 text-xs font-mono uppercase bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="mat-qty" className="block text-xs font-medium text-slate-700 mb-1">
                Quantity
              </label>
              <input
                id="mat-qty"
                type="number"
                min={0}
                step={1}
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full h-9 px-2.5 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label htmlFor="mat-unit" className="block text-xs font-medium text-slate-700 mb-1">
                Unit
              </label>
              <input
                id="mat-unit"
                type="text"
                required
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="pcs, kg, boxes"
                className="w-full h-9 px-2.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label htmlFor="mat-min" className="block text-xs font-medium text-slate-700 mb-1">
                Min Threshold
              </label>
              <input
                id="mat-min"
                type="number"
                min={0}
                step={1}
                required
                value={minThreshold}
                onChange={(e) => setMinThreshold(e.target.value)}
                className="w-full h-9 px-2.5 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded px-2.5 py-2">
              {error}
            </p>
          )}

          <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || sections.length === 0}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Saving...' : editingMaterial ? 'Save Changes' : 'Create Material'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
