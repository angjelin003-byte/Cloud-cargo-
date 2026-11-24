'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Material, Section } from '@/lib/types';

interface AdjustStockModalProps {
  material: Material;
  sections: Section[];
  onClose: () => void;
  onSubmit: (payload: {
    id: string;
    mode: 'INBOUND' | 'OUTBOUND' | 'TRANSFER' | 'ADJUST';
    delta: number;
    targetSectionId?: string;
    note: string;
  }) => Promise<{ ok: boolean; error?: string }>;
}

export function AdjustStockModal({
  material,
  sections,
  onClose,
  onSubmit,
}: AdjustStockModalProps) {
  const [mode, setMode] = useState<'INBOUND' | 'OUTBOUND' | 'TRANSFER' | 'ADJUST'>('INBOUND');
  const [amount, setAmount] = useState('10');
  const [targetSectionId, setTargetSectionId] = useState(() => {
    const otherSection = sections.find((s) => s.id !== material.sectionId);
    return otherSection?.id ?? material.sectionId;
  });
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const currentSection = sections.find((s) => s.id === material.sectionId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = Number(amount);
    let delta = 0;

    if (mode === 'INBOUND') {
      if (!Number.isInteger(parsed) || parsed <= 0) {
        setError('Inbound quantity must be a positive whole number.');
        return;
      }
      delta = parsed;
    } else if (mode === 'OUTBOUND') {
      if (!Number.isInteger(parsed) || parsed <= 0) {
        setError('Outbound quantity must be a positive whole number.');
        return;
      }
      delta = -parsed;
    } else if (mode === 'ADJUST') {
      if (!Number.isInteger(parsed) || parsed < 0) {
        setError('New cycle-count balance must be a non-negative whole number.');
        return;
      }
      delta = parsed - material.quantity;
    } else if (mode === 'TRANSFER') {
      delta = 0;
    }

    setSubmitting(true);
    const res = await onSubmit({
      id: material.id,
      mode,
      delta,
      targetSectionId: mode === 'TRANSFER' ? targetSectionId : undefined,
      note,
    });
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error ?? 'Failed to record movement.');
      return;
    }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="adjust-modal-title"
    >
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 id="adjust-modal-title" className="text-sm font-semibold text-slate-900">
              Stock Movement · {material.trackingCode}
            </h2>
            <p className="text-[11px] text-slate-500">
              {material.name} · Current: {material.quantity} {material.unit} ({currentSection?.code})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close stock movement dialog"
            className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <span className="block text-xs font-medium text-slate-700 mb-1.5">
              Movement Type
            </span>
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-md border border-slate-200">
              {(
                [
                  { id: 'INBOUND', label: 'Receive +' },
                  { id: 'OUTBOUND', label: 'Issue -' },
                  { id: 'TRANSFER', label: 'Transfer' },
                  { id: 'ADJUST', label: 'Set Count' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setMode(tab.id);
                    setError(null);
                    if (tab.id === 'ADJUST') {
                      setAmount(String(material.quantity));
                    } else {
                      setAmount('10');
                    }
                  }}
                  className={`py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                    mode === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {mode === 'TRANSFER' ? (
            <div>
              <label htmlFor="target-section" className="block text-xs font-medium text-slate-700 mb-1">
                Destination Section
              </label>
              <select
                id="target-section"
                value={targetSectionId}
                onChange={(e) => setTargetSectionId(e.target.value)}
                className="w-full h-9 px-2.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {sections.map((s) => (
                  <option key={s.id} value={s.id} disabled={s.id === material.sectionId}>
                    {s.code} — {s.name} {s.id === material.sectionId ? '(Current)' : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label htmlFor="movement-qty" className="block text-xs font-medium text-slate-700 mb-1">
                {mode === 'INBOUND'
                  ? `Units to Receive (${material.unit})`
                  : mode === 'OUTBOUND'
                    ? `Units to Dispatch (${material.unit})`
                    : `Verified Physical Count (${material.unit})`}
              </label>
              <input
                id="movement-qty"
                type="number"
                min={mode === 'ADJUST' ? 0 : 1}
                step={1}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full h-9 px-2.5 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          )}

          <div>
            <label htmlFor="movement-note" className="block text-xs font-medium text-slate-700 mb-1">
              Reference / Reason Note
            </label>
            <input
              id="movement-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. PO-1042, Work Order 88, Bay Audit"
              className="w-full h-9 px-2.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
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
              disabled={submitting || (mode === 'TRANSFER' && sections.length < 2)}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Updating...' : 'Confirm Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
