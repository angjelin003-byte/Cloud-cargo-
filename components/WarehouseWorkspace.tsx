'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type {
  ActiveSession,
  Material,
  OperatorRole,
  Section,
  StreamEvent,
  WarehouseSnapshotPayload,
  WarehouseState,
} from '@/lib/types';
import {
  computeWarehouseMetrics,
  filterAndSortMaterials,
  type MaterialFilters,
} from '@/lib/warehouse-logic';
import { TopBar, type WorkspaceTab } from './TopBar';
import { Sidebar } from './Sidebar';
import { MetricsStrip } from './MetricsStrip';
import { InventoryTable } from './InventoryTable';
import { SectionsView } from './SectionsView';
import { MovementsView } from './MovementsView';
import { OperatorsView } from './OperatorsView';
import { MaterialModal } from './MaterialModal';
import { SectionModal } from './SectionModal';
import { AdjustStockModal } from './AdjustStockModal';
import { TrackingLabelModal } from './TrackingLabelModal';

const OP_STORAGE_KEY = 'kargobin_operator_id';
const operatorListeners = new Set<() => void>();

function subscribeOperator(callback: () => void) {
  operatorListeners.add(callback);
  return () => operatorListeners.delete(callback);
}

function getOperatorSnapshot(fallbackId: string) {
  if (typeof window === 'undefined') return fallbackId;
  return sessionStorage.getItem(OP_STORAGE_KEY) || fallbackId;
}

function writeOperatorStorage(nextId: string) {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(OP_STORAGE_KEY, nextId);
  }
  for (const listener of operatorListeners) {
    listener();
  }
}

interface WarehouseWorkspaceProps {
  initialSnapshot: WarehouseSnapshotPayload;
}

export function WarehouseWorkspace({ initialSnapshot }: WarehouseWorkspaceProps) {
  const defaultOpId = initialSnapshot.state.operators[0]?.id ?? 'op-1';
  const [state, setState] = useState<WarehouseState>(initialSnapshot.state);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>(
    initialSnapshot.activeSessions
  );
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('inventory');
  const activeOperatorId = useSyncExternalStore(
    subscribeOperator,
    () => getOperatorSnapshot(defaultOpId),
    () => defaultOpId
  );
  const [connectionState, setConnectionState] = useState<
    'connecting' | 'live' | 'reconnecting'
  >('connecting');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [filters, setFilters] = useState<MaterialFilters>({
    query: '',
    sectionId: 'all',
    status: 'all',
    sortBy: 'updatedAt',
    sortDir: 'desc',
  });

  const [busyMaterialId, setBusyMaterialId] = useState<string | null>(null);
  const [materialModalOpen, setMaterialModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [adjustMaterial, setAdjustMaterial] = useState<Material | null>(null);
  const [labelMaterial, setLabelMaterial] = useState<Material | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<
    | { kind: 'material'; item: Material }
    | { kind: 'section'; item: Section }
    | null
  >(null);

  const [notice, setNotice] = useState<{
    tone: 'info' | 'error';
    text: string;
  } | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clientIdRef = useRef<string>('');

  const showNotice = useCallback((tone: 'info' | 'error', text: string) => {
    setNotice({ tone, text });
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => {
      setNotice(null);
    }, 4500);
  }, []);

  // Connect real-time SSE stream with per-tab sessionStorage identity and auto-reconnect
  useEffect(() => {
    if (!clientIdRef.current) {
      let storedClient = sessionStorage.getItem('kargobin_client_id');
      if (!storedClient) {
        storedClient =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID().slice(0, 12)
            : `tab-${Date.now()}`;
        sessionStorage.setItem('kargobin_client_id', storedClient);
      }
      clientIdRef.current = storedClient;
    }

    let closed = false;
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const connect = () => {
      if (closed) return;
      es = new EventSource(
        `/api/stream?clientId=${encodeURIComponent(
          clientIdRef.current
        )}&operatorId=${encodeURIComponent(activeOperatorId)}`
      );

      es.onopen = () => {
        attempt = 0;
        setConnectionState('live');
      };

      es.onmessage = (evt) => {
        try {
          const payload = JSON.parse(evt.data) as StreamEvent;
          if (payload.type === 'init') {
            setState(payload.state);
            setActiveSessions(payload.activeSessions);
          } else if (payload.type === 'state:sync') {
            setState(payload.state);
            setActiveSessions(payload.activeSessions);
            if (payload.lastEvent?.summary) {
              showNotice('info', payload.lastEvent.summary);
            }
          } else if (payload.type === 'presence:update') {
            setActiveSessions(payload.activeSessions);
          }
        } catch {
          // Ignore malformed keepalive frames
        }
      };

      es.onerror = () => {
        es?.close();
        if (closed) return;
        setConnectionState('reconnecting');
        attempt += 1;
        const delay = Math.min(8000, 500 * Math.pow(2, Math.min(attempt, 4)));
        retryTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
    };
  }, [activeOperatorId, showNotice]);

  const activeOperator = useMemo(
    () =>
      state.operators.find((o) => o.id === activeOperatorId) ??
      state.operators[0] ??
      null,
    [state.operators, activeOperatorId]
  );

  const metrics = useMemo(
    () => computeWarehouseMetrics(state.materials, state.sections),
    [state.materials, state.sections]
  );

  const filteredMaterials = useMemo(
    () => filterAndSortMaterials(state.materials, state.sections, filters),
    [state.materials, state.sections, filters]
  );

  const activeSection = useMemo(
    () => state.sections.find((s) => s.id === filters.sectionId) ?? null,
    [state.sections, filters.sectionId]
  );

  function handleSwitchOperator(nextOpId: string) {
    writeOperatorStorage(nextOpId);
    const nextOp = state.operators.find((o) => o.id === nextOpId);
    if (nextOp) {
      showNotice('info', `Switched operator to ${nextOp.name} (${nextOp.role})`);
    }
  }

  function applySnapshot(data: WarehouseSnapshotPayload) {
    setState(data.state);
    setActiveSessions(data.activeSessions);
  }

  async function handleQuickDelta(material: Material, delta: number) {
    setBusyMaterialId(material.id);
    try {
      const res = await fetch('/api/materials', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'stock',
          id: material.id,
          mode: delta > 0 ? 'INBOUND' : 'OUTBOUND',
          delta,
          operatorId: activeOperator?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotice('error', data.error || 'Failed to update stock.');
        return;
      }
      applySnapshot(data);
    } catch {
      showNotice('error', 'Network error while updating stock.');
    } finally {
      setBusyMaterialId(null);
    }
  }

  async function handleSaveMaterial(payload: {
    id?: string;
    trackingCode: string;
    name: string;
    category: string;
    sectionId: string;
    quantity: number;
    unit: string;
    minThreshold: number;
    lotNumber: string;
  }): Promise<{ ok: boolean; error?: string }> {
    try {
      const isEdit = Boolean(payload.id);
      const res = await fetch('/api/materials', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          operatorId: activeOperator?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.error || 'Failed to save material.' };
      }
      applySnapshot(data);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error while saving material.' };
    }
  }

  async function handleAdjustOrTransfer(payload: {
    id: string;
    mode: 'INBOUND' | 'OUTBOUND' | 'TRANSFER' | 'ADJUST';
    delta: number;
    targetSectionId?: string;
    note: string;
  }): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch('/api/materials', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'stock',
          ...payload,
          operatorId: activeOperator?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.error || 'Failed to update stock.' };
      }
      applySnapshot(data);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error while updating stock.' };
    }
  }

  async function handleSaveSection(payload: {
    id?: string;
    code: string;
    name: string;
    zone: string;
    capacity: number;
    description: string;
  }): Promise<{ ok: boolean; error?: string }> {
    try {
      const isEdit = Boolean(payload.id);
      const res = await fetch('/api/sections', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          operatorId: activeOperator?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.error || 'Failed to save section.' };
      }
      applySnapshot(data);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error while saving section.' };
    }
  }

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    const opParam = activeOperator?.id
      ? `&operatorId=${encodeURIComponent(activeOperator.id)}`
      : '';

    try {
      const url =
        confirmDelete.kind === 'material'
          ? `/api/materials?id=${encodeURIComponent(confirmDelete.item.id)}${opParam}`
          : `/api/sections?id=${encodeURIComponent(confirmDelete.item.id)}${opParam}`;
      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        showNotice('error', data.error || 'Delete failed.');
      } else {
        applySnapshot(data);
        if (
          confirmDelete.kind === 'section' &&
          filters.sectionId === confirmDelete.item.id
        ) {
          setFilters((f) => ({ ...f, sectionId: 'all' }));
        }
      }
    } catch {
      showNotice('error', 'Network error while deleting record.');
    } finally {
      setConfirmDelete(null);
    }
  }

  async function handleCreateOperator(input: {
    name: string;
    badgeCode: string;
    role: OperatorRole;
  }): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch('/api/operators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...input,
          actorId: activeOperator?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.error || 'Failed to add operator.' };
      }
      applySnapshot(data);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error while creating operator.' };
    }
  }

  async function handleUpdateOperatorRole(operatorId: string, role: OperatorRole) {
    try {
      const res = await fetch('/api/operators', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: operatorId,
          role,
          actorId: activeOperator?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotice('error', data.error || 'Failed to update role.');
        return;
      }
      applySnapshot(data);
    } catch {
      showNotice('error', 'Network error while updating operator role.');
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenAddMaterial={() => {
          setEditingMaterial(null);
          setMaterialModalOpen(true);
        }}
        onToggleMobileMenu={() => setMobileMenuOpen((v) => !v)}
      />

      {/* Mobile View Switcher (in-flow, non-sticky) */}
      <div className="md:hidden bg-white border-b border-slate-200 px-3 py-2 flex items-center gap-1 overflow-x-auto">
        {(
          [
            { id: 'inventory', label: 'Inventory' },
            { id: 'sections', label: 'Sections' },
            { id: 'movements', label: 'Movements' },
            { id: 'operators', label: 'Operators' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
              activeTab === tab.id
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-1 min-h-0">
        <Sidebar
          sections={state.sections}
          materials={state.materials}
          operators={state.operators}
          activeOperator={activeOperator}
          activeSessions={activeSessions}
          recentMovements={state.movements}
          selectedSectionId={filters.sectionId}
          connectionState={connectionState}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
          onSelectSection={(sectionId) => {
            setFilters((prev) => ({ ...prev, sectionId }));
            setActiveTab('inventory');
          }}
          onSwitchOperator={handleSwitchOperator}
          onOpenNewSection={() => {
            setEditingSection(null);
            setSectionModalOpen(true);
          }}
          onNavigateMovements={() => setActiveTab('movements')}
        />

        <main className="flex-1 min-w-0 p-4 lg:p-6 space-y-4">
          {notice && (
            <div
              role={notice.tone === 'error' ? 'alert' : 'status'}
              className={`px-3.5 py-2 rounded-md border text-xs font-medium flex items-center justify-between gap-3 ${
                notice.tone === 'error'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-blue-50 border-blue-200 text-blue-900'
              }`}
            >
              <span>{notice.text}</span>
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="text-current opacity-70 hover:opacity-100 font-semibold cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {activeTab === 'inventory' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                <div>
                  <h1 className="text-base font-semibold text-slate-900">
                    {activeSection
                      ? `${activeSection.code} · ${activeSection.name}`
                      : 'All Tracked Materials'}
                  </h1>
                  <p className="text-xs text-slate-500">
                    {activeSection
                      ? `${activeSection.zone} — ${activeSection.description || 'Filtered by section code'}`
                      : 'Real-time multi-user warehouse inventory with unique tracking and section codes.'}
                  </p>
                </div>
                <div className="text-xs text-slate-500 font-mono tabular-nums whitespace-nowrap">
                  Showing {filteredMaterials.length} of {state.materials.length} SKUs
                </div>
              </div>

              <MetricsStrip
                metrics={metrics}
                activeStatusFilter={filters.status}
                onFilterAlerts={() =>
                  setFilters((prev) => ({
                    ...prev,
                    status: prev.status === 'low' ? 'out' : prev.status === 'out' ? 'all' : 'low',
                  }))
                }
              />

              <InventoryTable
                materials={filteredMaterials}
                sections={state.sections}
                filters={filters}
                loading={false}
                busyMaterialId={busyMaterialId}
                onChangeFilters={(next) =>
                  setFilters((prev) => ({ ...prev, ...next }))
                }
                onResetFilters={() =>
                  setFilters({
                    query: '',
                    sectionId: 'all',
                    status: 'all',
                    sortBy: 'updatedAt',
                    sortDir: 'desc',
                  })
                }
                onQuickDelta={handleQuickDelta}
                onOpenAdjust={(mat) => setAdjustMaterial(mat)}
                onOpenEdit={(mat) => {
                  setEditingMaterial(mat);
                  setMaterialModalOpen(true);
                }}
                onOpenLabel={(mat) => setLabelMaterial(mat)}
                onDelete={(mat) => setConfirmDelete({ kind: 'material', item: mat })}
                onOpenAddMaterial={() => {
                  setEditingMaterial(null);
                  setMaterialModalOpen(true);
                }}
              />
            </div>
          )}

          {activeTab === 'sections' && (
            <SectionsView
              sections={state.sections}
              materials={state.materials}
              onOpenNewSection={() => {
                setEditingSection(null);
                setSectionModalOpen(true);
              }}
              onOpenEditSection={(sec) => {
                setEditingSection(sec);
                setSectionModalOpen(true);
              }}
              onDeleteSection={(sec) => setConfirmDelete({ kind: 'section', item: sec })}
              onInspectSection={(sectionId) => {
                setFilters((prev) => ({ ...prev, sectionId }));
                setActiveTab('inventory');
              }}
            />
          )}

          {activeTab === 'movements' && (
            <MovementsView movements={state.movements} />
          )}

          {activeTab === 'operators' && (
            <OperatorsView
              operators={state.operators}
              activeOperator={activeOperator}
              activeSessions={activeSessions}
              onSwitchOperator={handleSwitchOperator}
              onCreateOperator={handleCreateOperator}
              onUpdateRole={handleUpdateOperatorRole}
            />
          )}
        </main>
      </div>

      {/* Conditionally Mounted Modals */}
      {materialModalOpen && (
        <MaterialModal
          key={editingMaterial?.id ?? 'new-material'}
          editingMaterial={editingMaterial}
          sections={state.sections}
          existingMaterials={state.materials}
          defaultSectionId={
            filters.sectionId !== 'all' ? filters.sectionId : undefined
          }
          onClose={() => {
            setMaterialModalOpen(false);
            setEditingMaterial(null);
          }}
          onSubmit={handleSaveMaterial}
        />
      )}

      {sectionModalOpen && (
        <SectionModal
          key={editingSection?.id ?? 'new-section'}
          editingSection={editingSection}
          onClose={() => {
            setSectionModalOpen(false);
            setEditingSection(null);
          }}
          onSubmit={handleSaveSection}
        />
      )}

      {adjustMaterial && (
        <AdjustStockModal
          key={adjustMaterial.id}
          material={adjustMaterial}
          sections={state.sections}
          onClose={() => setAdjustMaterial(null)}
          onSubmit={handleAdjustOrTransfer}
        />
      )}

      {labelMaterial && (
        <TrackingLabelModal
          key={labelMaterial.id}
          material={labelMaterial}
          section={state.sections.find((s) => s.id === labelMaterial.sectionId)}
          onClose={() => setLabelMaterial(null)}
        />
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-title"
        >
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-lg shadow-lg p-4 space-y-3">
            <h2 id="confirm-delete-title" className="text-sm font-semibold text-slate-900">
              {confirmDelete.kind === 'material'
                ? `Delete ${confirmDelete.item.trackingCode}?`
                : `Delete Section ${confirmDelete.item.code}?`}
            </h2>
            <p className="text-xs text-slate-600">
              {confirmDelete.kind === 'material'
                ? `Remove "${confirmDelete.item.name}" from active warehouse inventory. Historical movement logs are preserved.`
                : `Permanently delete empty section "${confirmDelete.item.name}".`}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-md hover:bg-red-700 cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
