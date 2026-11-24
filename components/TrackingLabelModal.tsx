'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, X } from 'lucide-react';
import type { Material, Section } from '@/lib/types';
import { buildBarcodePattern } from '@/lib/warehouse-logic';

interface TrackingLabelModalProps {
  material: Material;
  section: Section | undefined;
  onClose: () => void;
}

export function TrackingLabelModal({
  material,
  section,
  onClose,
}: TrackingLabelModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { rects, totalWidth } = useMemo(() => {
    const bars = buildBarcodePattern(material.trackingCode);
    const items: { x: number; w: number }[] = [];
    let offset = 0;
    for (let idx = 0; idx < bars.length; idx++) {
      const width = bars[idx] * 2;
      if (idx % 2 === 0) {
        items.push({ x: offset, w: width });
      }
      offset += width;
    }
    return { rects: items, totalWidth: offset };
  }, [material.trackingCode]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(material.trackingCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard may be restricted in headless contexts
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="label-modal-title"
    >
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 id="label-modal-title" className="text-sm font-semibold text-slate-900">
            Material Tracking Label
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close label dialog"
            className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          <div className="border border-slate-300 rounded-md p-3.5 bg-slate-50 space-y-2.5">
            <div className="flex items-baseline justify-between gap-2 border-b border-slate-200 pb-2">
              <span className="text-xs font-semibold text-slate-900 truncate">
                {material.name}
              </span>
              <span className="font-mono text-xs font-bold text-blue-700 shrink-0">
                SEC {section?.code ?? 'N/A'}
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded p-2.5 flex flex-col items-center">
              <svg
                viewBox={`0 0 ${Math.max(1, totalWidth)} 40`}
                className="w-full h-11"
                aria-label={`Barcode for ${material.trackingCode}`}
              >
                {rects.map((r, i) => (
                  <rect
                    key={i}
                    x={r.x}
                    y={0}
                    width={r.w}
                    height={40}
                    fill="#0f172a"
                  />
                ))}
              </svg>
              <span className="mt-1.5 font-mono text-sm font-bold tracking-wider text-slate-900">
                {material.trackingCode}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-600 font-mono tabular-nums">
              <span>LOT: {material.lotNumber || 'N/A'}</span>
              <span>
                QTY: {material.quantity} {material.unit}
              </span>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy Code
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
