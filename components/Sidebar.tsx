'use client';

import { memo, useMemo } from 'react';
import { Download, FileText, Plus, Trash2, UserPlus, X } from 'lucide-react';
import type { ActiveSession, Material, Movement, Operator, Section, SharedFile } from '@/lib/types';

interface SidebarProps {
  sections: Section[];
  materials: Material[];
  operators: Operator[];
  files: SharedFile[];
  activeOperator: Operator | null;
  activeSessions: ActiveSession[];
  recentMovements: Movement[];
  selectedSectionId: string | 'all';
  connectionState: 'connecting' | 'live' | 'reconnecting';
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onSelectSection: (sectionId: string | 'all') => void;
  onSwitchOperator: (operatorId: string) => void;
  onOpenNewSection: () => void;
  onNavigateMovements: () => void;
  onNavigateOperators: () => void;
  onOpenQuickFile: (file: SharedFile | null, defaultFolder?: string) => void;
  onOpenClearData: () => void;
}

export const Sidebar = memo(function Sidebar({
  sections,
  materials,
  operators,
  files,
  activeOperator,
  activeSessions,
  recentMovements,
  selectedSectionId,
  connectionState,
  mobileOpen,
  onCloseMobile,
  onSelectSection,
  onSwitchOperator,
  onOpenNewSection,
  onNavigateMovements,
  onNavigateOperators,
  onOpenQuickFile,
  onOpenClearData,
}: SidebarProps) {
  const countsBySection = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of materials) {
      map.set(m.sectionId, (map.get(m.sectionId) ?? 0) + 1);
    }
    return map;
  }, [materials]);

  const onlineOperatorCount = useMemo(
    () => new Set(activeSessions.map((s) => s.operatorId)).size,
    [activeSessions]
  );

  const activeOperators = useMemo(
    () => operators.filter((o) => o.active),
    [operators]
  );

  const hasAnyData =
    sections.length > 0 ||
    materials.length > 0 ||
    files.length > 0 ||
    recentMovements.length > 0 ||
    operators.length > 0;

  const sidebarBody = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 w-64 select-none">
      {/* Active User / Operator Switcher */}
      <div className="p-3.5 border-b border-slate-200">
        <div className="flex items-center justify-between mb-1.5">
          <label
            htmlFor="active-operator-select"
            className="text-xs font-semibold text-slate-700"
          >
            Active User Account
          </label>
          <span className="text-[11px] font-mono tabular-nums text-slate-500">
            {connectionState === 'live'
              ? `${activeSessions.length} live`
              : connectionState === 'connecting'
                ? 'Syncing'
                : 'Reconnecting'}
          </span>
        </div>

        {activeOperators.length === 0 ? (
          <button
            type="button"
            onClick={() => {
              onCloseMobile();
              onNavigateOperators();
            }}
            className="w-full h-9 px-2.5 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
            Create User Account
          </button>
        ) : (
          <>
            <select
              id="active-operator-select"
              value={activeOperator?.id ?? ''}
              onChange={(e) => onSwitchOperator(e.target.value)}
              className="w-full h-9 px-2.5 text-xs font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            >
              {activeOperators.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.name} ({op.badgeCode})
                </option>
              ))}
            </select>
            {activeOperator && (
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                <span>{activeOperator.role}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{activeOperator.badgeCode}</span>
                <span aria-hidden="true">·</span>
                <span>{onlineOperatorCount} online</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Sections, Quick Shared Files, & Live Activity */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-slate-700">Warehouse Sections</h2>
            <button
              type="button"
              onClick={() => {
                onCloseMobile();
                onOpenNewSection();
              }}
              aria-label="Create new section"
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 px-1.5 py-0.5 rounded focus-visible:outline-2 focus-visible:outline-blue-600 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              New
            </button>
          </div>

          <ul className="space-y-0.5">
            <li>
              <button
                type="button"
                onClick={() => {
                  onSelectSection('all');
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md transition-colors cursor-pointer ${
                  selectedSectionId === 'all'
                    ? 'bg-slate-900 text-white font-medium'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="truncate">All Sections</span>
                <span className="font-mono tabular-nums text-[11px] opacity-80">
                  {materials.length}
                </span>
              </button>
            </li>
            {sections.map((sec) => {
              const active = selectedSectionId === sec.id;
              const skuCount = countsBySection.get(sec.id) ?? 0;
              return (
                <li key={sec.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectSection(sec.id);
                      onCloseMobile();
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs rounded-md transition-colors cursor-pointer ${
                      active
                        ? 'bg-blue-50 text-blue-900 font-semibold border border-blue-200'
                        : 'text-slate-700 hover:bg-slate-100 border border-transparent'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className={`font-mono text-[11px] shrink-0 ${
                          active ? 'text-blue-700' : 'text-slate-500'
                        }`}
                      >
                        {sec.code}
                      </span>
                      <span className="truncate">{sec.name}</span>
                    </span>
                    <span className="font-mono tabular-nums text-[11px] text-slate-500 shrink-0">
                      {skuCount}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Quick Shared Files (Multi-place file editing) */}
        <div className="pt-3 border-t border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-slate-700">Quick Edit Files</h2>
            <button
              type="button"
              onClick={() => {
                onCloseMobile();
                onOpenQuickFile(null);
              }}
              aria-label="Create shared file"
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 px-1.5 py-0.5 rounded cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              New
            </button>
          </div>
          {files.length === 0 ? (
            <p className="text-xs text-slate-400">No shared files yet.</p>
          ) : (
            <ul className="space-y-1">
              {files.slice(0, 5).map((file) => (
                <li key={file.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onCloseMobile();
                      onOpenQuickFile(file);
                    }}
                    className="w-full flex items-center justify-between gap-2 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 rounded-md cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      <FileText className="w-3 h-3 text-slate-400 shrink-0" aria-hidden="true" />
                      <span className="font-mono truncate">{file.name}</span>
                    </span>
                    <span className="font-mono text-[10px] text-slate-400 shrink-0">
                      v{file.revision}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Compact Recent Movements Feed + Export log.txt */}
        <div className="pt-3 border-t border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-slate-700">Live Activity</h2>
            <div className="flex items-center gap-2">
              <a
                href="/api/export/log"
                download="log.txt"
                title="Export log.txt"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900"
              >
                <Download className="w-3 h-3" aria-hidden="true" />
                log.txt
              </a>
              <button
                type="button"
                onClick={() => {
                  onCloseMobile();
                  onNavigateMovements();
                }}
                className="text-[11px] font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
              >
                View all
              </button>
            </div>
          </div>
          {recentMovements.length === 0 ? (
            <p className="text-xs text-slate-400">No recent activity.</p>
          ) : (
            <ul className="space-y-2">
              {recentMovements.slice(0, 4).map((mov) => (
                <li key={mov.id} className="text-[11px] leading-snug border-b border-slate-100 pb-1.5 last:border-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono font-semibold text-slate-800 truncate">
                      {mov.trackingCode}
                    </span>
                    <span
                      className={`font-mono tabular-nums font-semibold shrink-0 ${
                        mov.delta > 0
                          ? 'text-emerald-700'
                          : mov.delta < 0
                            ? 'text-amber-700'
                            : 'text-slate-600'
                      }`}
                    >
                      {mov.delta > 0 ? `+${mov.delta}` : mov.delta === 0 ? mov.sectionCode : mov.delta}
                    </span>
                  </div>
                  <div className="text-slate-500 truncate">
                    {mov.operatorName} · {mov.sectionCode}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Clear All Data Footer */}
      {hasAnyData && (
        <div className="p-3 border-t border-slate-200 bg-slate-50/60">
          <button
            type="button"
            onClick={() => {
              onCloseMobile();
              onOpenClearData();
            }}
            className="w-full px-2.5 py-1.5 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-red-700 bg-white border border-red-200 rounded-md hover:bg-red-50 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            Clear All Data
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop persistent compact sidebar */}
      <aside className="hidden lg:block shrink-0">{sidebarBody}</aside>

      {/* Mobile slide-over drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 flex h-full">
            {sidebarBody}
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close navigation drawer"
              className="m-2 h-9 w-9 rounded-md bg-white text-slate-700 flex items-center justify-center shadow-sm"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
});
