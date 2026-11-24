import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  ActiveSession,
  Material,
  Movement,
  MovementType,
  Operator,
  OperatorRole,
  Section,
  StreamEvent,
  WarehouseSnapshotPayload,
  WarehouseState,
} from './types';
import {
  applyStockDelta,
  normalizeCode,
  validateMaterialInput,
  validateSectionInput,
  type MaterialInput,
  type SectionInput,
} from './warehouse-logic';

type Subscriber = (event: StreamEvent) => void;

interface WarehouseHub {
  state: WarehouseState;
  subscribers: Set<Subscriber>;
  sessions: Map<string, ActiveSession>;
  initialized: boolean;
}

declare global {
  var __kargobinHub: WarehouseHub | undefined;
}

const DATA_DIR = path.join(process.cwd(), '.warehouse-data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

function createSeedState(): WarehouseState {
  const baseTime = '2026-11-23T08:30:00.000Z';

  const operators: Operator[] = [
    {
      id: 'op-1',
      name: 'Elena Vance',
      badgeCode: 'OP-101',
      role: 'Admin',
      active: true,
      createdAt: baseTime,
    },
    {
      id: 'op-2',
      name: 'Marcus Chen',
      badgeCode: 'OP-104',
      role: 'Supervisor',
      active: true,
      createdAt: baseTime,
    },
    {
      id: 'op-3',
      name: 'Priya Nair',
      badgeCode: 'OP-109',
      role: 'Operator',
      active: true,
      createdAt: baseTime,
    },
    {
      id: 'op-4',
      name: 'David Kowalski',
      badgeCode: 'OP-112',
      role: 'Operator',
      active: true,
      createdAt: baseTime,
    },
  ];

  const sections: Section[] = [
    {
      id: 'sec-a01',
      code: 'A-01',
      name: 'Structural Metals',
      zone: 'Zone A · Bay 1',
      capacity: 600,
      description: 'Extruded aluminum profiles, steel plates, and alloy bars',
      createdAt: baseTime,
      updatedAt: baseTime,
    },
    {
      id: 'sec-b04',
      code: 'B-04',
      name: 'Fasteners & Anchors',
      zone: 'Zone B · Rack 4',
      capacity: 1500,
      description: 'Metric hex bolts, lock nuts, washers, and anchor sleeves',
      createdAt: baseTime,
      updatedAt: baseTime,
    },
    {
      id: 'sec-c02',
      code: 'C-02',
      name: 'Electrical & Sensors',
      zone: 'Zone C · ESD Cage',
      capacity: 450,
      description: 'Proximity sensors, DIN relays, shielded cable reels',
      createdAt: baseTime,
      updatedAt: baseTime,
    },
    {
      id: 'sec-d01',
      code: 'D-01',
      name: 'Packaging & Pallets',
      zone: 'Zone D · Dock',
      capacity: 900,
      description: 'Corrugated cartons, stretch wrap rolls, pallet strapping',
      createdAt: baseTime,
      updatedAt: baseTime,
    },
    {
      id: 'sec-e03',
      code: 'E-03',
      name: 'Sealants & Adhesives',
      zone: 'Zone E · Climate',
      capacity: 300,
      description: 'Industrial epoxy cartridges, silicone sealants, primers',
      createdAt: baseTime,
      updatedAt: baseTime,
    },
  ];

  const materials: Material[] = [
    {
      id: 'mat-1',
      trackingCode: 'A01-ALU-001',
      name: 'Aluminum Sheet 6061-T6 (3mm)',
      category: 'Metals',
      sectionId: 'sec-a01',
      quantity: 48,
      unit: 'sheets',
      minThreshold: 15,
      lotNumber: 'LOT-2611A',
      updatedAt: '2026-11-23T09:15:00.000Z',
      updatedBy: 'Elena Vance',
    },
    {
      id: 'mat-2',
      trackingCode: 'A01-STL-002',
      name: 'Cold-Rolled Steel Rod 16mm',
      category: 'Metals',
      sectionId: 'sec-a01',
      quantity: 120,
      unit: 'bars',
      minThreshold: 30,
      lotNumber: 'LOT-2610S',
      updatedAt: '2026-11-23T09:20:00.000Z',
      updatedBy: 'Marcus Chen',
    },
    {
      id: 'mat-3',
      trackingCode: 'B04-HEX-001',
      name: 'M8x30 Stainless Hex Bolt',
      category: 'Fasteners',
      sectionId: 'sec-b04',
      quantity: 14,
      unit: 'boxes',
      minThreshold: 20,
      lotNumber: 'LOT-884B',
      updatedAt: '2026-11-23T09:42:00.000Z',
      updatedBy: 'Priya Nair',
    },
    {
      id: 'mat-4',
      trackingCode: 'B04-LCK-002',
      name: 'M8 Nyloc Flange Nut',
      category: 'Fasteners',
      sectionId: 'sec-b04',
      quantity: 65,
      unit: 'boxes',
      minThreshold: 15,
      lotNumber: 'LOT-885N',
      updatedAt: '2026-11-23T09:30:00.000Z',
      updatedBy: 'Priya Nair',
    },
    {
      id: 'mat-5',
      trackingCode: 'C02-PRX-001',
      name: 'Inductive Proximity Sensor 24V',
      category: 'Electrical',
      sectionId: 'sec-c02',
      quantity: 0,
      unit: 'pcs',
      minThreshold: 12,
      lotNumber: 'LOT-402E',
      updatedAt: '2026-11-23T10:05:00.000Z',
      updatedBy: 'Marcus Chen',
    },
    {
      id: 'mat-6',
      trackingCode: 'C02-DIN-002',
      name: '24VDC DIN-Rail Relay Module',
      category: 'Electrical',
      sectionId: 'sec-c02',
      quantity: 34,
      unit: 'pcs',
      minThreshold: 10,
      lotNumber: 'LOT-409R',
      updatedAt: '2026-11-23T09:50:00.000Z',
      updatedBy: 'David Kowalski',
    },
    {
      id: 'mat-7',
      trackingCode: 'C02-CBL-003',
      name: 'Shielded Control Cable 4-Core',
      category: 'Electrical',
      sectionId: 'sec-c02',
      quantity: 7,
      unit: 'reels',
      minThreshold: 8,
      lotNumber: 'LOT-412C',
      updatedAt: '2026-11-23T10:12:00.000Z',
      updatedBy: 'David Kowalski',
    },
    {
      id: 'mat-8',
      trackingCode: 'D01-STR-001',
      name: 'Heavy Pallet Stretch Film 500mm',
      category: 'Packaging',
      sectionId: 'sec-d01',
      quantity: 92,
      unit: 'rolls',
      minThreshold: 25,
      lotNumber: 'LOT-711P',
      updatedAt: '2026-11-23T09:10:00.000Z',
      updatedBy: 'Priya Nair',
    },
    {
      id: 'mat-9',
      trackingCode: 'D01-BOX-002',
      name: 'Double-Wall Shipping Carton 40x30',
      category: 'Packaging',
      sectionId: 'sec-d01',
      quantity: 210,
      unit: 'pcs',
      minThreshold: 50,
      lotNumber: 'LOT-718K',
      updatedAt: '2026-11-23T09:12:00.000Z',
      updatedBy: 'Elena Vance',
    },
    {
      id: 'mat-10',
      trackingCode: 'E03-EPX-001',
      name: 'Two-Part Structural Epoxy 400ml',
      category: 'Chemicals',
      sectionId: 'sec-e03',
      quantity: 9,
      unit: 'tubes',
      minThreshold: 10,
      lotNumber: 'LOT-903X',
      updatedAt: '2026-11-23T10:22:00.000Z',
      updatedBy: 'Marcus Chen',
    },
    {
      id: 'mat-11',
      trackingCode: 'E03-SIL-002',
      name: 'High-Temp Silicone Gasket Sealant',
      category: 'Chemicals',
      sectionId: 'sec-e03',
      quantity: 28,
      unit: 'tubes',
      minThreshold: 8,
      lotNumber: 'LOT-907G',
      updatedAt: '2026-11-23T09:45:00.000Z',
      updatedBy: 'Elena Vance',
    },
  ];

  const movements: Movement[] = [
    {
      id: 'mov-1',
      type: 'OUTBOUND',
      materialId: 'mat-10',
      trackingCode: 'E03-EPX-001',
      materialName: 'Two-Part Structural Epoxy 400ml',
      sectionCode: 'E-03',
      delta: -6,
      newQuantity: 9,
      operatorId: 'op-2',
      operatorName: 'Marcus Chen',
      operatorRole: 'Supervisor',
      note: 'Issued to Assembly Line 2',
      timestamp: '2026-11-23T10:22:00.000Z',
    },
    {
      id: 'mov-2',
      type: 'OUTBOUND',
      materialId: 'mat-5',
      trackingCode: 'C02-PRX-001',
      materialName: 'Inductive Proximity Sensor 24V',
      sectionCode: 'C-02',
      delta: -12,
      newQuantity: 0,
      operatorId: 'op-2',
      operatorName: 'Marcus Chen',
      operatorRole: 'Supervisor',
      note: 'Dispatched for Maintenance WO-441',
      timestamp: '2026-11-23T10:05:00.000Z',
    },
    {
      id: 'mov-3',
      type: 'INBOUND',
      materialId: 'mat-8',
      trackingCode: 'D01-STR-001',
      materialName: 'Heavy Pallet Stretch Film 500mm',
      sectionCode: 'D-01',
      delta: 40,
      newQuantity: 92,
      operatorId: 'op-3',
      operatorName: 'Priya Nair',
      operatorRole: 'Operator',
      note: 'Dock Gate 3 receiving PO-9921',
      timestamp: '2026-11-23T09:10:00.000Z',
    },
  ];

  return {
    version: 1,
    sections,
    materials,
    operators,
    movements,
  };
}

function loadStateFromDisk(): WarehouseState {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as WarehouseState;
      if (
        parsed &&
        Array.isArray(parsed.sections) &&
        Array.isArray(parsed.materials) &&
        Array.isArray(parsed.operators) &&
        Array.isArray(parsed.movements)
      ) {
        return parsed;
      }
    }
  } catch {
    // Fall back to fresh seed state on unreadable file
  }
  const seed = createSeedState();
  persistStateToDisk(seed);
  return seed;
}

function persistStateToDisk(state: WarehouseState): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmpFile = `${DATA_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DATA_FILE);
  } catch {
    // Non-fatal in read-only environments; in-memory state remains authoritative
  }
}

function getHub(): WarehouseHub {
  if (!globalThis.__kargobinHub) {
    globalThis.__kargobinHub = {
      state: loadStateFromDisk(),
      subscribers: new Set<Subscriber>(),
      sessions: new Map<string, ActiveSession>(),
      initialized: true,
    };
  }
  return globalThis.__kargobinHub;
}

export function getWarehouseSnapshot(): WarehouseSnapshotPayload {
  const hub = getHub();
  return {
    state: hub.state,
    activeSessions: Array.from(hub.sessions.values()),
  };
}

function broadcast(event: StreamEvent): void {
  const hub = getHub();
  for (const sub of hub.subscribers) {
    try {
      sub(event);
    } catch {
      hub.subscribers.delete(sub);
    }
  }
}

export function subscribeToStream(
  subscriber: Subscriber,
  sessionInfo?: { clientId: string; operatorId: string }
): () => void {
  const hub = getHub();
  hub.subscribers.add(subscriber);

  if (sessionInfo?.clientId) {
    const operator =
      hub.state.operators.find((o) => o.id === sessionInfo.operatorId) ??
      hub.state.operators[0];
    if (operator) {
      hub.sessions.set(sessionInfo.clientId, {
        clientId: sessionInfo.clientId,
        operatorId: operator.id,
        operatorName: operator.name,
        operatorRole: operator.role,
        connectedAt: new Date().toISOString(),
      });
      broadcast({
        type: 'presence:update',
        activeSessions: Array.from(hub.sessions.values()),
      });
    }
  }

  return () => {
    hub.subscribers.delete(subscriber);
    if (sessionInfo?.clientId && hub.sessions.has(sessionInfo.clientId)) {
      hub.sessions.delete(sessionInfo.clientId);
      broadcast({
        type: 'presence:update',
        activeSessions: Array.from(hub.sessions.values()),
      });
    }
  };
}

function resolveOperator(operatorId?: string): Operator {
  const hub = getHub();
  return (
    hub.state.operators.find((o) => o.id === operatorId && o.active) ??
    hub.state.operators.find((o) => o.active) ??
    hub.state.operators[0]
  );
}

function commitMutation(
  nextState: WarehouseState,
  lastEvent: { action: string; actorName: string; summary: string }
): WarehouseSnapshotPayload {
  const hub = getHub();
  hub.state = {
    ...nextState,
    version: hub.state.version + 1,
    movements: nextState.movements.slice(0, 150),
  };
  persistStateToDisk(hub.state);
  const activeSessions = Array.from(hub.sessions.values());
  broadcast({
    type: 'state:sync',
    state: hub.state,
    activeSessions,
    lastEvent,
  });
  return {
    state: hub.state,
    activeSessions,
  };
}

export function createSectionRecord(
  input: SectionInput,
  operatorId?: string
): { ok: true; data: WarehouseSnapshotPayload; section: Section } | { ok: false; status: number; error: string } {
  const hub = getHub();
  const validation = validateSectionInput(input, hub.state.sections);
  if (!validation.ok || !validation.value) {
    return { ok: false, status: 400, error: validation.error ?? 'Invalid section input.' };
  }

  const actor = resolveOperator(operatorId);
  const now = new Date().toISOString();
  const newSection: Section = {
    id: `sec-${crypto.randomUUID().slice(0, 8)}`,
    code: validation.value.code,
    name: validation.value.name,
    zone: validation.value.zone,
    capacity: validation.value.capacity,
    description: validation.value.description ?? '',
    createdAt: now,
    updatedAt: now,
  };

  const data = commitMutation(
    {
      ...hub.state,
      sections: [...hub.state.sections, newSection],
    },
    {
      action: 'section:created',
      actorName: actor.name,
      summary: `${actor.name} created section ${newSection.code} (${newSection.name})`,
    }
  );

  return { ok: true, data, section: newSection };
}

export function updateSectionRecord(
  id: string,
  input: SectionInput,
  operatorId?: string
): { ok: true; data: WarehouseSnapshotPayload } | { ok: false; status: number; error: string } {
  const hub = getHub();
  const existing = hub.state.sections.find((s) => s.id === id);
  if (!existing) {
    return { ok: false, status: 404, error: 'Section not found.' };
  }

  const validation = validateSectionInput(input, hub.state.sections, id);
  if (!validation.ok || !validation.value) {
    return { ok: false, status: 400, error: validation.error ?? 'Invalid section input.' };
  }

  const actor = resolveOperator(operatorId);
  const now = new Date().toISOString();
  const updatedSection: Section = {
    ...existing,
    code: validation.value.code,
    name: validation.value.name,
    zone: validation.value.zone,
    capacity: validation.value.capacity,
    description: validation.value.description ?? '',
    updatedAt: now,
  };

  const data = commitMutation(
    {
      ...hub.state,
      sections: hub.state.sections.map((s) => (s.id === id ? updatedSection : s)),
    },
    {
      action: 'section:updated',
      actorName: actor.name,
      summary: `${actor.name} updated section ${updatedSection.code}`,
    }
  );

  return { ok: true, data };
}

export function deleteSectionRecord(
  id: string,
  operatorId?: string
): { ok: true; data: WarehouseSnapshotPayload } | { ok: false; status: number; error: string } {
  const hub = getHub();
  const existing = hub.state.sections.find((s) => s.id === id);
  if (!existing) {
    return { ok: false, status: 404, error: 'Section not found.' };
  }

  const assignedCount = hub.state.materials.filter((m) => m.sectionId === id).length;
  if (assignedCount > 0) {
    return {
      ok: false,
      status: 409,
      error: `Cannot delete section ${existing.code}: ${assignedCount} tracked material(s) are still assigned to it.`,
    };
  }

  const actor = resolveOperator(operatorId);
  const data = commitMutation(
    {
      ...hub.state,
      sections: hub.state.sections.filter((s) => s.id !== id),
    },
    {
      action: 'section:deleted',
      actorName: actor.name,
      summary: `${actor.name} removed empty section ${existing.code}`,
    }
  );

  return { ok: true, data };
}

export function createMaterialRecord(
  input: MaterialInput,
  operatorId?: string
): { ok: true; data: WarehouseSnapshotPayload; material: Material } | { ok: false; status: number; error: string } {
  const hub = getHub();
  const validation = validateMaterialInput(input, hub.state.sections, hub.state.materials);
  if (!validation.ok || !validation.value) {
    return { ok: false, status: 400, error: validation.error ?? 'Invalid material input.' };
  }

  const actor = resolveOperator(operatorId);
  const section = hub.state.sections.find((s) => s.id === validation.value!.sectionId)!;
  const now = new Date().toISOString();

  const material: Material = {
    id: `mat-${crypto.randomUUID().slice(0, 8)}`,
    trackingCode: validation.value.trackingCode,
    name: validation.value.name,
    category: validation.value.category,
    sectionId: validation.value.sectionId,
    quantity: validation.value.quantity,
    unit: validation.value.unit,
    minThreshold: validation.value.minThreshold,
    lotNumber: validation.value.lotNumber || `LOT-${now.slice(2, 10).replace(/-/g, '')}`,
    updatedAt: now,
    updatedBy: actor.name,
  };

  const movement: Movement = {
    id: `mov-${crypto.randomUUID().slice(0, 8)}`,
    type: 'CREATED',
    materialId: material.id,
    trackingCode: material.trackingCode,
    materialName: material.name,
    sectionCode: section.code,
    delta: material.quantity,
    newQuantity: material.quantity,
    operatorId: actor.id,
    operatorName: actor.name,
    operatorRole: actor.role,
    note: `Registered in section ${section.code}`,
    timestamp: now,
  };

  const data = commitMutation(
    {
      ...hub.state,
      materials: [material, ...hub.state.materials],
      movements: [movement, ...hub.state.movements],
    },
    {
      action: 'material:created',
      actorName: actor.name,
      summary: `${actor.name} added ${material.trackingCode} (${material.quantity} ${material.unit}) to ${section.code}`,
    }
  );

  return { ok: true, data, material };
}

export function updateMaterialMetadataRecord(
  id: string,
  input: MaterialInput,
  operatorId?: string
): { ok: true; data: WarehouseSnapshotPayload } | { ok: false; status: number; error: string } {
  const hub = getHub();
  const existing = hub.state.materials.find((m) => m.id === id);
  if (!existing) {
    return { ok: false, status: 404, error: 'Material not found.' };
  }

  const validation = validateMaterialInput(input, hub.state.sections, hub.state.materials, id);
  if (!validation.ok || !validation.value) {
    return { ok: false, status: 400, error: validation.error ?? 'Invalid material input.' };
  }

  const actor = resolveOperator(operatorId);
  const newSection = hub.state.sections.find((s) => s.id === validation.value!.sectionId)!;
  const oldSection = hub.state.sections.find((s) => s.id === existing.sectionId);
  const now = new Date().toISOString();

  const updated: Material = {
    ...existing,
    trackingCode: validation.value.trackingCode,
    name: validation.value.name,
    category: validation.value.category,
    sectionId: validation.value.sectionId,
    quantity: validation.value.quantity,
    unit: validation.value.unit,
    minThreshold: validation.value.minThreshold,
    lotNumber: validation.value.lotNumber || existing.lotNumber,
    updatedAt: now,
    updatedBy: actor.name,
  };

  const delta = updated.quantity - existing.quantity;
  const movedSection = existing.sectionId !== updated.sectionId;
  const movType: MovementType = movedSection ? 'TRANSFER' : 'UPDATED';

  const movement: Movement = {
    id: `mov-${crypto.randomUUID().slice(0, 8)}`,
    type: movType,
    materialId: updated.id,
    trackingCode: updated.trackingCode,
    materialName: updated.name,
    sectionCode: newSection.code,
    previousSectionCode: movedSection ? oldSection?.code : undefined,
    delta,
    newQuantity: updated.quantity,
    operatorId: actor.id,
    operatorName: actor.name,
    operatorRole: actor.role,
    note: movedSection
      ? `Relocated ${oldSection?.code ?? '?'} -> ${newSection.code}`
      : 'Updated material record',
    timestamp: now,
  };

  const data = commitMutation(
    {
      ...hub.state,
      materials: hub.state.materials.map((m) => (m.id === id ? updated : m)),
      movements: [movement, ...hub.state.movements],
    },
    {
      action: 'material:updated',
      actorName: actor.name,
      summary: `${actor.name} updated ${updated.trackingCode} in ${newSection.code}`,
    }
  );

  return { ok: true, data };
}

export function adjustOrTransferMaterial(
  params: {
    id: string;
    mode: 'INBOUND' | 'OUTBOUND' | 'TRANSFER' | 'ADJUST';
    delta?: number;
    targetSectionId?: string;
    note?: string;
  },
  operatorId?: string
): { ok: true; data: WarehouseSnapshotPayload } | { ok: false; status: number; error: string } {
  const hub = getHub();
  const existing = hub.state.materials.find((m) => m.id === params.id);
  if (!existing) {
    return { ok: false, status: 404, error: 'Material not found.' };
  }

  const actor = resolveOperator(operatorId);
  const currentSection = hub.state.sections.find((s) => s.id === existing.sectionId);
  const now = new Date().toISOString();

  let nextSectionId = existing.sectionId;
  let nextSectionCode = currentSection?.code ?? 'UNKNOWN';
  let previousSectionCode: string | undefined;

  if (params.mode === 'TRANSFER') {
    if (!params.targetSectionId) {
      return { ok: false, status: 400, error: 'Target section is required for transfer.' };
    }
    const targetSec = hub.state.sections.find((s) => s.id === params.targetSectionId);
    if (!targetSec) {
      return { ok: false, status: 404, error: 'Target section not found.' };
    }
    if (targetSec.id === existing.sectionId) {
      return { ok: false, status: 400, error: `Material is already in section ${targetSec.code}.` };
    }
    previousSectionCode = currentSection?.code;
    nextSectionId = targetSec.id;
    nextSectionCode = targetSec.code;
  }

  const requestedDelta = params.delta ?? 0;
  const stockResult = applyStockDelta(existing.quantity, requestedDelta);
  if (!stockResult.ok || !stockResult.value) {
    return { ok: false, status: 400, error: stockResult.error ?? 'Invalid stock adjustment.' };
  }

  const updated: Material = {
    ...existing,
    sectionId: nextSectionId,
    quantity: stockResult.value.newQuantity,
    updatedAt: now,
    updatedBy: actor.name,
  };

  const defaultNote =
    params.mode === 'TRANSFER'
      ? `Transferred ${previousSectionCode ?? '?'} -> ${nextSectionCode}`
      : params.mode === 'INBOUND'
        ? `Received +${stockResult.value.delta} ${existing.unit}`
        : params.mode === 'OUTBOUND'
          ? `Dispatched ${stockResult.value.delta} ${existing.unit}`
          : `Cycle count adjustment (${stockResult.value.delta >= 0 ? '+' : ''}${stockResult.value.delta})`;

  const movement: Movement = {
    id: `mov-${crypto.randomUUID().slice(0, 8)}`,
    type: params.mode,
    materialId: updated.id,
    trackingCode: updated.trackingCode,
    materialName: updated.name,
    sectionCode: nextSectionCode,
    previousSectionCode,
    delta: stockResult.value.delta,
    newQuantity: updated.quantity,
    operatorId: actor.id,
    operatorName: actor.name,
    operatorRole: actor.role,
    note: (params.note ?? '').trim().slice(0, 120) || defaultNote,
    timestamp: now,
  };

  const data = commitMutation(
    {
      ...hub.state,
      materials: hub.state.materials.map((m) => (m.id === params.id ? updated : m)),
      movements: [movement, ...hub.state.movements],
    },
    {
      action: 'stock:changed',
      actorName: actor.name,
      summary: `${actor.name}: ${updated.trackingCode} ${
        params.mode === 'TRANSFER'
          ? `moved to ${nextSectionCode}`
          : `${stockResult.value.delta >= 0 ? '+' : ''}${stockResult.value.delta} ${updated.unit} (now ${updated.quantity})`
      }`,
    }
  );

  return { ok: true, data };
}

export function deleteMaterialRecord(
  id: string,
  operatorId?: string
): { ok: true; data: WarehouseSnapshotPayload } | { ok: false; status: number; error: string } {
  const hub = getHub();
  const existing = hub.state.materials.find((m) => m.id === id);
  if (!existing) {
    return { ok: false, status: 404, error: 'Material not found.' };
  }

  const actor = resolveOperator(operatorId);
  const data = commitMutation(
    {
      ...hub.state,
      materials: hub.state.materials.filter((m) => m.id !== id),
    },
    {
      action: 'material:deleted',
      actorName: actor.name,
      summary: `${actor.name} removed ${existing.trackingCode} (${existing.name})`,
    }
  );

  return { ok: true, data };
}

export function createOperatorRecord(
  input: { name: string; badgeCode: string; role: OperatorRole },
  actorId?: string
): { ok: true; data: WarehouseSnapshotPayload; operator: Operator } | { ok: false; status: number; error: string } {
  const hub = getHub();
  const name = input.name.trim();
  const badgeCode = normalizeCode(input.badgeCode);
  const validRoles: OperatorRole[] = ['Admin', 'Supervisor', 'Operator'];

  if (!name || name.length < 2 || name.length > 50) {
    return { ok: false, status: 400, error: 'Operator name must be between 2 and 50 characters.' };
  }

  if (!badgeCode || badgeCode.length < 3 || badgeCode.length > 16) {
    return { ok: false, status: 400, error: 'Badge code must be 3–16 characters (e.g. OP-120).' };
  }

  if (hub.state.operators.some((o) => o.badgeCode.toUpperCase() === badgeCode)) {
    return { ok: false, status: 409, error: `Badge code "${badgeCode}" is already assigned.` };
  }

  if (!validRoles.includes(input.role)) {
    return { ok: false, status: 400, error: 'Invalid operator role.' };
  }

  const actor = resolveOperator(actorId);
  const operator: Operator = {
    id: `op-${crypto.randomUUID().slice(0, 8)}`,
    name,
    badgeCode,
    role: input.role,
    active: true,
    createdAt: new Date().toISOString(),
  };

  const data = commitMutation(
    {
      ...hub.state,
      operators: [...hub.state.operators, operator],
    },
    {
      action: 'operator:created',
      actorName: actor.name,
      summary: `${actor.name} added operator ${operator.name} (${operator.badgeCode})`,
    }
  );

  return { ok: true, data, operator };
}

export function updateOperatorRoleRecord(
  id: string,
  updates: { role?: OperatorRole; active?: boolean },
  actorId?: string
): { ok: true; data: WarehouseSnapshotPayload } | { ok: false; status: number; error: string } {
  const hub = getHub();
  const target = hub.state.operators.find((o) => o.id === id);
  if (!target) {
    return { ok: false, status: 404, error: 'Operator not found.' };
  }

  if (updates.active === false) {
    const activeAdmins = hub.state.operators.filter((o) => o.active && o.role === 'Admin');
    if (target.role === 'Admin' && activeAdmins.length <= 1) {
      return { ok: false, status: 400, error: 'At least one active Admin operator is required.' };
    }
  }

  const actor = resolveOperator(actorId);
  const updated: Operator = {
    ...target,
    role: updates.role ?? target.role,
    active: updates.active ?? target.active,
  };

  const data = commitMutation(
    {
      ...hub.state,
      operators: hub.state.operators.map((o) => (o.id === id ? updated : o)),
    },
    {
      action: 'operator:updated',
      actorName: actor.name,
      summary: `${actor.name} updated ${updated.name} (${updated.role})`,
    }
  );

  return { ok: true, data };
}
