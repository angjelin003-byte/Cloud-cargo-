'use client';

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type {
  ActiveSession,
  Material,
  OperatorRole,
  Section,
  SharedFile,
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
import { FilesView } from './FilesView';
import { MovementsView } from './MovementsView';
import { OperatorsView } from './OperatorsView';
import { MaterialModal } from './MaterialModal';
import { SectionModal } from './SectionModal';
import { AdjustStockModal } from './AdjustStockModal';
import { TrackingLabelModal } from './TrackingLabelModal';
import { QuickFileModal } from './QuickFileModal';

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
    if (nextId) {
      sessionStorage.setItem(OP_STORAGE_KEY, nextId);
    } else {
      sessionStorage.removeItem(OP_STORAGE_KEY);
    }
  }
  for (const listener of operatorListeners) {
    listener();
  }
}

interface WarehouseWorkspaceProps {
  initialSnapshot: WarehouseSnapshotPayload;
}

export function WarehouseWorkspace({ initialSnapshot }: WarehouseWorkspaceProps) {
  const defaultOpId = initialSnapshot.state.operators[0]?.id ?? '';
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

  const [quickFileModal, setQuickFileModal] = useState<{
    open: boolean;
    fileId: string | null;
    defaultFolder?: string;
  }>({ open: false, fileId: null });

  const [clearDataOpen, setClearDataOpen] = useState(false);
  const [clearIncludeOperators, setClearIncludeOperators] = useState(false);
  const [clearingData, setClearingData] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<
    | { kind: 'material'; item: Material }
    | { kind: 'section'; item: Section }
    | { kind: 'file'; item: SharedFile }
    | null
  >(null);

  const [notice, setNotice] = useState<{
    tone: 'info' | 'error';
    text: string;
  } | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clientIdRef = useRef<string>('');
  const activeOperatorIdRef = useRef<string>(activeOperatorId);

  useEffect(() => {
    activeOperatorIdRef.current = activeOperatorId;
  }, [activeOperatorId]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  const showNotice = useCallback((tone: 'info' | 'error', text: string) => {
    setNotice({ tone, text });
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => {
      setNotice(null);
    }, 4500);
  }, []);

  // Connect real-time SSE stream once per tab with per-tab sessionStorage identity and auto-reconnect
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
        )}&operatorId=${encodeURIComponent(activeOperatorIdRef.current)}`
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
            setState((prev) =>
              payload.state.version >= prev.version ? payload.state : prev
            );
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
  }, [showNotice]);

  const activeOperator = useMemo(
    () =>
      state.operators.find((o) => o.id === activeOperatorId && o.active) ??
      state.operators.find((o) => o.active) ??
      state.operators[0] ??
      null,
    [state.operators, activeOperatorId]
  );

  const metrics = useMemo(
    () => computeWarehouseMetrics(state.materials, state.sections),
    [state.materials, state.sections]
  );

  const deferredQuery = useDeferredValue(filters.query);

  const deferredFilters = useMemo<MaterialFilters>(
    () => ({
      ...filters,
      query: deferredQuery,
    }),
    [filters, deferredQuery]
  );

  const filteredMaterials = useMemo(
    () => filterAndSortMaterials(state.materials, state.sections, deferredFilters),
    [state.materials, state.sections, deferredFilters]
  );

  const activeSection = useMemo(
    () => state.sections.find((s) => s.id === filters.sectionId) ?? null,
    [state.sections, filters.sectionId]
  );

  const liveQuickFile = useMemo(
    () =>
      quickFileModal.fileId
        ? state.files.find((f) => f.id === quickFileModal.fileId) ?? null
        : null,
    [quickFileModal.fileId, state.files]
  );

  const applySnapshot = useCallback((data: WarehouseSnapshotPayload) => {
    setState((prev) => (data.state.version >= prev.version ? data.state : prev));
    setActiveSessions(data.activeSessions);
  }, []);

  const syncStreamPresence = useCallback((operatorId: string) => {
    if (!clientIdRef.current) return;
    void fetch('/api/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: clientIdRef.current,
        operatorId,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { activeSessions?: ActiveSession[] } | null) => {
        if (data?.activeSessions) {
          setActiveSessions(data.activeSessions);
        }
      })
      .catch(() => {
        // Presence sync will recover on next heartbeat/reconnect
      });
  }, []);

  const handleSwitchOperator = useCallback(
    (nextOpId: string) => {
      writeOperatorStorage(nextOpId);
      const nextOp = state.operators.find((o) => o.id === nextOpId);
      if (nextOp) {
        showNotice('info', `Switched account to ${nextOp.name} (${nextOp.role})`);
      }
      syncStreamPresence(nextOpId);
    },
    [state.operators, showNotice, syncStreamPresence]
  );

  const activeOpId = activeOperator?.id;

  const handleQuickDelta = useCallback(
    async (material: Material, delta: number) => {
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
            operatorId: activeOpId,
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
    },
    [activeOpId, applySnapshot, showNotice]
  );

  const handleSaveMaterial = useCallback(
    async (payload: {
      id?: string;
      trackingCode: string;
      name: string;
      category: string;
      sectionId: string;
      quantity: number;
      unit: string;
      minThreshold: number;
      lotNumber: string;
    }): Promise<{ ok: boolean; error?: string }> => {
      try {
        const isEdit = Boolean(payload.id);
        const res = await fetch('/api/materials', {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            operatorId: activeOpId,
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
    },
    [activeOpId, applySnapshot]
  );

  const handleSaveInlineMaterial = useCallback(
    async (
      material: Material,
      updates: {
        name: string;
        sectionId: string;
        quantity: number;
        minThreshold: number;
        lotNumber: string;
      }
    ) => {
      return handleSaveMaterial({
        id: material.id,
        trackingCode: material.trackingCode,
        category: material.category,
        unit: material.unit,
        name: updates.name,
        sectionId: updates.sectionId,
        quantity: updates.quantity,
        minThreshold: updates.minThreshold,
        lotNumber: updates.lotNumber,
      });
    },
    [handleSaveMaterial]
  );

  const handleBulkAction = useCallback(
    async (payload: {
      ids: string[];
      bulkAction: 'transfer' | 'delete';
      targetSectionId?: string;
    }): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await fetch('/api/materials', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'bulk',
            ...payload,
            operatorId: activeOpId,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { ok: false, error: data.error || 'Bulk action failed.' };
        }
        applySnapshot(data);
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error during bulk action.' };
      }
    },
    [activeOpId, applySnapshot]
  );

  const handleAdjustOrTransfer = useCallback(
    async (payload: {
      id: string;
      mode: 'INBOUND' | 'OUTBOUND' | 'TRANSFER' | 'ADJUST';
      delta: number;
      targetSectionId?: string;
      note: string;
    }): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await fetch('/api/materials', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'stock',
            ...payload,
            operatorId: activeOpId,
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
    },
    [activeOpId, applySnapshot]
  );

  const handleSaveSection = useCallback(
    async (payload: {
      id?: string;
      code: string;
      name: string;
      zone: string;
      capacity: number;
      description: string;
    }): Promise<{ ok: boolean; error?: string }> => {
      try {
        const isEdit = Boolean(payload.id);
        const res = await fetch('/api/sections', {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            operatorId: activeOpId,
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
    },
    [activeOpId, applySnapshot]
  );

  const handleCreateFile = useCallback(
    async (payload: {
      name: string;
      folder: string;
      content: string;
    }): Promise<{ ok: boolean; error?: string; file?: SharedFile }> => {
      try {
        const res = await fetch('/api/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            operatorId: activeOpId,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { ok: false, error: data.error || 'Failed to create file.' };
        }
        applySnapshot(data);
        return { ok: true, file: data.file };
      } catch {
        return { ok: false, error: 'Network error while creating file.' };
      }
    },
    [activeOpId, applySnapshot]
  );

  const handleUpdateFile = useCallback(
    async (payload: {
      id: string;
      name: string;
      folder: string;
      content: string;
    }): Promise<{ ok: boolean; error?: string; file?: SharedFile }> => {
      try {
        const res = await fetch('/api/files', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            operatorId: activeOpId,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { ok: false, error: data.error || 'Failed to save file.' };
        }
        applySnapshot(data);
        return { ok: true, file: data.file };
      } catch {
        return { ok: false, error: 'Network error while saving file.' };
      }
    },
    [activeOpId, applySnapshot]
  );

  const handleSaveQuickFile = useCallback(
    async (payload: {
      id?: string;
      name: string;
      folder: string;
      content: string;
    }) => {
      if (payload.id) {
        return handleUpdateFile({
          id: payload.id,
          name: payload.name,
          folder: payload.folder,
          content: payload.content,
        });
      }
      return handleCreateFile({
        name: payload.name,
        folder: payload.folder,
        content: payload.content,
      });
    },
    [handleCreateFile, handleUpdateFile]
  );

  const handleDeleteFile = useCallback(async (file: SharedFile) => {
    setConfirmDelete({ kind: 'file', item: file });
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!confirmDelete) return;
    const opParam = activeOpId
      ? `&operatorId=${encodeURIComponent(activeOpId)}`
      : '';

    try {
      const url =
        confirmDelete.kind === 'material'
          ? `/api/materials?id=${encodeURIComponent(confirmDelete.item.id)}${opParam}`
          : confirmDelete.kind === 'section'
            ? `/api/sections?id=${encodeURIComponent(confirmDelete.item.id)}${opParam}`
            : `/api/files?id=${encodeURIComponent(confirmDelete.item.id)}${opParam}`;

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
  }, [activeOpId, applySnapshot, confirmDelete, filters.sectionId, showNotice]);

  const handleCreateOperator = useCallback(
    async (input: {
      name: string;
      badgeCode: string;
      role: OperatorRole;
    }): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await fetch('/api/operators', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...input,
            actorId: activeOpId,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { ok: false, error: data.error || 'Failed to add user account.' };
        }
        applySnapshot(data);
        if (!activeOpId && data.operator?.id) {
          writeOperatorStorage(data.operator.id);
          syncStreamPresence(data.operator.id);
        }
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error while creating user account.' };
      }
    },
    [activeOpId, applySnapshot, syncStreamPresence]
  );

  const handleUpdateOperator = useCallback(
    async (
      operatorId: string,
      updates: { name?: string; badgeCode?: string; role?: OperatorRole }
    ): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await fetch('/api/operators', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: operatorId,
            ...updates,
            actorId: activeOpId,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { ok: false, error: data.error || 'Failed to update user account.' };
        }
        applySnapshot(data);
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error while updating user account.' };
      }
    },
    [activeOpId, applySnapshot]
  );

  const handleDeleteOperator = useCallback(
    async (operatorId: string) => {
      try {
        const actorParam = activeOpId
          ? `&actorId=${encodeURIComponent(activeOpId)}`
          : '';
        const res = await fetch(
          `/api/operators?id=${encodeURIComponent(operatorId)}${actorParam}`,
          { method: 'DELETE' }
        );
        const data = await res.json();
        if (!res.ok) {
          showNotice('error', data.error || 'Failed to delete user account.');
          return;
        }
        applySnapshot(data);
        if (activeOpId === operatorId) {
          const nextOpId = data.state?.operators?.[0]?.id ?? '';
          writeOperatorStorage(nextOpId);
          syncStreamPresence(nextOpId);
        }
      } catch {
        showNotice('error', 'Network error while deleting user account.');
      }
    },
    [activeOpId, applySnapshot, showNotice, syncStreamPresence]
  );

  const handleClearAllData = useCallback(async () => {
    setClearingData(true);
    try {
      const opParam = activeOpId
        ? `&operatorId=${encodeURIComponent(activeOpId)}`
        : '';
      const res = await fetch(
        `/api/warehouse?includeOperators=${clearIncludeOperators}${opParam}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) {
        showNotice('error', data.error || 'Failed to clear warehouse data.');
        return;
      }
      applySnapshot(data);
      setFilters({
        query: '',
        sectionId: 'all',
        status: 'all',
        sortBy: 'updatedAt',
        sortDir: 'desc',
      });
      if (clearIncludeOperators) {
        writeOperatorStorage('');
        syncStreamPresence('');
      }
      setClearDataOpen(false);
      showNotice('info', 'All warehouse data has been cleared.');
    } catch {
      showNotice('error', 'Network error while clearing data.');
    } finally {
      setClearingData(false);
    }
  }, [activeOpId, applySnapshot, clearIncludeOperators, showNotice, syncStreamPresence]);

  const handleCloseMobile = useCallback(() => setMobileMenuOpen(false), []);
  const handleSelectSection = useCallback((sectionId: string | 'all') => {
    setFilters((prev) => ({ ...prev, sectionId }));
    setActiveTab('inventory');
  }, []);
  const handleOpenNewSection = useCallback(() => {
    setEditingSection(null);
    setSectionModalOpen(true);
  }, []);
  const handleNavigateMovements = useCallback(() => setActiveTab('movements'), []);
  const handleNavigateOperators = useCallback(() => setActiveTab('operators'), []);
  const handleFilterAlerts = useCallback(
    () =>
      setFilters((prev) => ({
        ...prev,
        status: prev.status === 'low' ? 'out' : prev.status === 'out' ? 'all' : 'low',
      })),
    []
  );
  const handleChangeFilters = useCallback(
    (next: Partial<MaterialFilters>) => setFilters((prev) => ({ ...prev, ...next })),
    []
  );
  const handleResetFilters = useCallback(
    () =>
      setFilters({
        query: '',
        sectionId: 'all',
        status: 'all',
        sortBy: 'updatedAt',
        sortDir: 'desc',
      }),
    []
  );
  const handleOpenAddMaterial = useCallback(() => {
    setEditingMaterial(null);
    setMaterialModalOpen(true);
  }, []);
  const handleOpenEditMaterial = useCallback((mat: Material) => {
    setEditingMaterial(mat);
    setMaterialModalOpen(true);
  }, []);
  const handleDeleteMaterial = useCallback(
    (mat: Material) => setConfirmDelete({ kind: 'material', item: mat }),
    []
  );
  const handleOpenEditSection = useCallback((sec: Section) => {
    setEditingSection(sec);
    setSectionModalOpen(true);
  }, []);
  const handleDeleteSection = useCallback(
    (sec: Section) => setConfirmDelete({ kind: 'section', item: sec }),
    []
  );
  const handleOpenQuickFile = useCallback(
    (file: SharedFile | null, defaultFolder?: string) => {
      setQuickFileModal({
        open: true,
        fileId: file?.id ?? null,
        defaultFolder,
      });
    },
    []
  );
  const handleOpenSectionFile = useCallback(
    (sectionCode: string, existingFile: SharedFile | null) => {
      setQuickFileModal({
        open: true,
        fileId: existingFile?.id ?? null,
        defaultFolder: sectionCode,
      });
    },
    []
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenAddMaterial={handleOpenAddMaterial}
        onToggleMobileMenu={() => setMobileMenuOpen((v) => !v)}
      />

      {/* Mobile View Switcher (in-flow, non-sticky) */}
      <div className="md:hidden bg-white border-b border-slate-200 px-2 py-2 flex items-center justify-between gap-1 overflow-x-auto">
        {(
          [
            { id: 'inventory', label: 'Inventory' },
            { id: 'sections', label: 'Sections' },
            { id: 'files', label: 'Files' },
            { id: 'movements', label: 'Movements' },
            { id: 'operators', label: 'Operators' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-2 py-1.5 text-[11px] font-medium rounded-md whitespace-nowrap shrink-0 ${
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
          files={state.files}
          activeOperator={activeOperator}
          activeSessions={activeSessions}
          recentMovements={state.movements}
          selectedSectionId={filters.sectionId}
          connectionState={connectionState}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={handleCloseMobile}
          onSelectSection={handleSelectSection}
          onSwitchOperator={handleSwitchOperator}
          onOpenNewSection={handleOpenNewSection}
          onNavigateMovements={handleNavigateMovements}
          onNavigateOperators={handleNavigateOperators}
          onOpenQuickFile={handleOpenQuickFile}
          onOpenClearData={() => setClearDataOpen(true)}
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
                onFilterAlerts={handleFilterAlerts}
              />

              <InventoryTable
                materials={filteredMaterials}
                sections={state.sections}
                operatorCount={state.operators.length}
                sectionCount={state.sections.length}
                filters={filters}
                loading={false}
                busyMaterialId={busyMaterialId}
                onChangeFilters={handleChangeFilters}
                onResetFilters={handleResetFilters}
                onQuickDelta={handleQuickDelta}
                onOpenAdjust={setAdjustMaterial}
                onOpenEdit={handleOpenEditMaterial}
                onSaveInlineEdit={handleSaveInlineMaterial}
                onBulkAction={handleBulkAction}
                onOpenLabel={setLabelMaterial}
                onDelete={handleDeleteMaterial}
                onOpenAddMaterial={handleOpenAddMaterial}
                onOpenNewSection={handleOpenNewSection}
                onNavigateOperators={handleNavigateOperators}
                onOpenQuickFile={() => handleOpenQuickFile(null)}
              />
            </div>
          )}

          {activeTab === 'sections' && (
            <SectionsView
              sections={state.sections}
              materials={state.materials}
              files={state.files}
              onOpenNewSection={handleOpenNewSection}
              onOpenEditSection={handleOpenEditSection}
              onDeleteSection={handleDeleteSection}
              onInspectSection={handleSelectSection}
              onOpenSectionFile={handleOpenSectionFile}
            />
          )}

          {activeTab === 'files' && (
            <FilesView
              files={state.files}
              sections={state.sections}
              onCreateFile={handleCreateFile}
              onUpdateFile={handleUpdateFile}
              onDeleteFile={handleDeleteFile}
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
              onUpdateOperator={handleUpdateOperator}
              onDeleteOperator={handleDeleteOperator}
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
          onOpenNewSection={handleOpenNewSection}
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

      {quickFileModal.open && (
        <QuickFileModal
          key={`${quickFileModal.fileId ?? 'new-file'}-${quickFileModal.defaultFolder ?? 'General'}`}
          file={liveQuickFile}
          sections={state.sections}
          defaultFolder={quickFileModal.defaultFolder}
          onClose={() => setQuickFileModal({ open: false, fileId: null })}
          onSaveFile={handleSaveQuickFile}
        />
      )}

      {clearDataOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-data-title"
        >
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-lg shadow-lg p-4 space-y-3">
            <h2 id="clear-data-title" className="text-sm font-semibold text-slate-900">
              Clear All Warehouse Data?
            </h2>
            <p className="text-xs text-slate-600">
              This removes all sections, materials, shared files, and activity logs across all connected user accounts.
            </p>
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={clearIncludeOperators}
                onChange={(e) => setClearIncludeOperators(e.target.checked)}
                className="rounded border-slate-300 text-red-600 focus:ring-red-600"
              />
              Also remove all user accounts
            </label>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setClearDataOpen(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={clearingData}
                onClick={handleClearAllData}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 cursor-pointer"
              >
                {clearingData ? 'Clearing...' : 'Confirm Clear All'}
              </button>
            </div>
          </div>
        </div>
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
                : confirmDelete.kind === 'section'
                  ? `Delete Section ${confirmDelete.item.code}?`
                  : `Delete File ${confirmDelete.item.name}?`}
            </h2>
            <p className="text-xs text-slate-600">
              {confirmDelete.kind === 'material'
                ? `Remove "${confirmDelete.item.name}" from active warehouse inventory. Historical movement logs are preserved.`
                : confirmDelete.kind === 'section'
                  ? `Permanently delete empty section "${confirmDelete.item.name}".`
                  : `Remove shared file "${confirmDelete.item.name}" across all user accounts.`}
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

