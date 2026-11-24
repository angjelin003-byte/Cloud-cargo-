'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Section } from '@/lib/types';
import { normalizeCode } from '@/lib/warehouse-logic';

interface SectionModalProps {
  editingSection: Section | null;
  onClose: () => void;
  onSubmit: (payload: {
    id?: string;
    code: string;
    name: string;
    zone: string;
    capacity: number;
    description: string;
  }) => Promise<{ ok: boolean; error?: string }>;
}

export function SectionModal({
  editingSection,
  onClose,
  onSubmit,
}: SectionModalProps) {
  const [code, setCode] = useState(editingSection?.code ?? '');
  const [name, setName] = useState(editingSection?.name ?? '');
  const [zone, setZone] = useState(editingSection?.zone ?? '');
  const [capacity, setCapacity] = useState(
    editingSection ? String(editingSection.capacity) : '500'
  );
  const [description, setDescription] = useState(editingSection?.description ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await onSubmit({
      id: editingSection?.id,
      code: normalizeCode(code),
      name,
      zone,
      capacity: Number(capacity),
      description,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not save section.');
      return;
    }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="section-modal-title"
    >
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 id="section-modal-title" className="text-sm font-semibold text-slate-900">
            {editingSection ? `Edit Section ${editingSection.code}` : 'New Warehouse Section'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close section dialog"
            className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="sec-code" className="block text-xs font-medium text-slate-700 mb-1">
                Unique Section Code
              </label>
              <input
                id="sec-code"
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. Z-09"
                className="w-full h-9 px-2.5 text-xs font-mono uppercase bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label htmlFor="sec-capacity" className="block text-xs font-medium text-slate-700 mb-1">
                Max Unit Capacity
              </label>
              <input
                id="sec-capacity"
                type="number"
                min={1}
                step={1}
                required
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className="w-full h-9 px-2.5 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div>
            <label htmlFor="sec-name" className="block text-xs font-medium text-slate-700 mb-1">
              Section Name
            </label>
            <input
              id="sec-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cold Storage Bay"
              className="w-full h-9 px-2.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label htmlFor="sec-zone" className="block text-xs font-medium text-slate-700 mb-1">
              Zone / Aisle Location
            </label>
            <input
              id="sec-zone"
              type="text"
              required
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              placeholder="e.g. Zone Z · Rack 2"
              className="w-full h-9 px-2.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label htmlFor="sec-desc" className="block text-xs font-medium text-slate-700 mb-1">
              Description
            </label>
            <input
              id="sec-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional storage rules or material types"
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
              disabled={submitting}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Saving...' : editingSection ? 'Update Section' : 'Create Section'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
