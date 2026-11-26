'use client';

import { memo, useMemo } from 'react';
import { FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Material, Section, SharedFile } from '@/lib/types';

interface SectionsViewProps {
  sections: Section[];
  materials: Material[];
  files: SharedFile[];
  onOpenNewSection: () => void;
  onOpenEditSection: (section: Section) => void;
  onDeleteSection: (section: Section) => void;
  onInspectSection: (sectionId: string) => void;
  onOpenSectionFile: (sectionCode: string, existingFile: SharedFile | null) => void;
}

export const SectionsView = memo(function SectionsView({
  sections,
  materials,
  files,
  onOpenNewSection,
  onOpenEditSection,
  onDeleteSection,
  onInspectSection,
  onOpenSectionFile,
}: SectionsViewProps) {
  const statsMap = useMemo(() => {
    const map = new Map<string, { skus: number; units: number }>();
    for (const m of materials) {
      const prev = map.get(m.sectionId) ?? { skus: 0, units: 0 };
      map.set(m.sectionId, {
        skus: prev.skus + 1,
        units: prev.units + m.quantity,
      });
    }
    return map;
  }, [materials]);

  const filesBySectionCode = useMemo(() => {
    const map = new Map<string, SharedFile>();
    for (const f of files) {
      if (!map.has(f.folder)) map.set(f.folder, f);
    }
    return map;
  }, [files]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold text-slate-900">Warehouse Sections</h1>
          <p className="text-xs text-slate-500">
            Unique section codes organize bays, racks, and material tracking prefixes.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenNewSection}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          New Section
        </button>
      </div>

      {sections.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg py-10 px-4 text-center">
          <p className="text-sm font-semibold text-slate-900">No sections configured</p>
          <p className="mt-1 text-xs text-slate-500">
            Create your first warehouse section with a unique location code.
          </p>
          <button
            type="button"
            onClick={onOpenNewSection}
            className="mt-3 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 cursor-pointer"
          >
            Create First Section
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                  <th className="py-2 px-3 whitespace-nowrap">Section Code</th>
                  <th className="py-2 px-3 whitespace-nowrap">Name & Description</th>
                  <th className="py-2 px-3 whitespace-nowrap">Zone / Aisle</th>
                  <th className="py-2 px-3 whitespace-nowrap text-right">SKUs</th>
                  <th className="py-2 px-3 whitespace-nowrap">Utilization</th>
                  <th className="py-2 px-3 whitespace-nowrap text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {sections.map((sec) => {
                  const stats = statsMap.get(sec.id) ?? { skus: 0, units: 0 };
                  const pct = Math.min(100, Math.round((stats.units / Math.max(1, sec.capacity)) * 100));

                  return (
                    <tr key={sec.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onInspectSection(sec.id)}
                          className="font-mono font-semibold text-blue-700 hover:underline cursor-pointer"
                        >
                          {sec.code}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 min-w-[200px]">
                        <div className="font-medium text-slate-900">{sec.name}</div>
                        {sec.description && (
                          <div className="text-[11px] text-slate-500 truncate max-w-xs">
                            {sec.description}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">{sec.zone}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-right font-mono tabular-nums text-slate-900">
                        {stats.skus}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap min-w-[160px]">
                        <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-600 mb-1">
                          <span>
                            {stats.units} / {sec.capacity}
                          </span>
                          <span>{pct}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              pct >= 90
                                ? 'bg-red-600'
                                : pct >= 75
                                  ? 'bg-amber-600'
                                  : 'bg-blue-600'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          {(() => {
                            const linkedFile = filesBySectionCode.get(sec.code) ?? null;
                            return (
                              <button
                                type="button"
                                onClick={() => onOpenSectionFile(sec.code, linkedFile)}
                                aria-label={
                                  linkedFile
                                    ? `Edit file ${linkedFile.name} for section ${sec.code}`
                                    : `Add file for section ${sec.code}`
                                }
                                className="px-2 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded inline-flex items-center gap-1 cursor-pointer"
                              >
                                <FileText className="w-3 h-3" aria-hidden="true" />
                                {linkedFile ? 'Edit File' : '+ File'}
                              </button>
                            );
                          })()}
                          <button
                            type="button"
                            onClick={() => onInspectSection(sec.id)}
                            className="px-2 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
                          >
                            View Items
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenEditSection(sec)}
                            aria-label={`Edit section ${sec.code}`}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteSection(sec)}
                            aria-label={`Delete section ${sec.code}`}
                            title={
                              stats.skus > 0
                                ? 'Move or remove assigned materials before deleting'
                                : 'Delete empty section'
                            }
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
        </div>
      )}
    </div>
  );
});
