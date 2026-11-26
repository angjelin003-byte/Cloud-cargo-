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
  SharedFile,
  StreamEvent,
  WarehouseSnapshotPayload,
  WarehouseState,
} from './types';
import {
  applyStockDelta,
  normalizeCode,
  validateFileInput,
  validateMaterialInput,
  validateSectionInput,
  type MaterialInput,
  type SectionInput,
  type SharedFileInput,
} from './warehouse-logic';

type Subscriber = (chunk: Uint8Array) => void;

interface WarehouseHub {
  state: WarehouseState;
  subscribers: Set<Subscriber>;
  sessions: Map<string, ActiveSession>;
  initialized: boolean;
  persistTimer: ReturnType<typeof setTimeout> | null;
  persisting: boolean;
  persistQueued: boolean;
}

declare global {
  var __kargobinHub: WarehouseHub | undefined;
}

const DATA_DIR = path.join(process.cwd(), '.warehouse-data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');
const sseEncoder = new TextEncoder();

export function encodeSseEvent(event: StreamEvent): Uint8Array {
  return sseEncoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

function createSeedState(): WarehouseState {
  return {
    version: 1,
    sections: [],
    materials: [],
    operators: [],
    movements: [],
    files: [],
  };
}

function loadStateFromDisk(): WarehouseState {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<WarehouseState>;
      if (
        parsed &&
        Array.isArray(parsed.sections) &&
        Array.isArray(parsed.materials) &&
        Array.isArray(parsed.operators) &&
        Array.isArray(parsed.movements)
      ) {
        return {
          version: typeof parsed.version === 'number' ? parsed.version : 1,
          sections: parsed.sections,
          materials: parsed.materials,
          operators: parsed.operators,
          movements: parsed.movements,
          files: Array.isArray(parsed.files) ? parsed.files : [],
        };
      }
    }
  } catch {
    // Fall back to fresh empty state on unreadable file
  }
  const seed = createSeedState();
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed), 'utf-8');
  } catch {
    // Non-fatal in read-only environments
  }
  return seed;
}

async function flushPersistQueue(): Promise<void> {
  const hub = getHub();
  if (hub.persisting) {
    hub.persistQueued = true;
    return;
  }
  hub.persisting = true;
  try {
    do {
      hub.persistQueued = false;
      const serialized = JSON.stringify(hub.state);
      await fs.promises.mkdir(DATA_DIR, { recursive: true });
      const tmpFile = `${DATA_FILE}.${process.pid}.tmp`;
      await fs.promises.writeFile(tmpFile, serialized, 'utf-8');
      await fs.promises.rename(tmpFile, DATA_FILE);
    } while (hub.persistQueued);
  } catch {
    // Non-fatal in read-only environments; in-memory state remains authoritative
  } finally {
    hub.persisting = false;
  }
}

function scheduleDiskPersist(): void {
  const hub = getHub();
  if (hub.persistTimer) {
    clearTimeout(hub.persistTimer);
  }
  hub.persistTimer = setTimeout(() => {
    hub.persistTimer = null;
    void flushPersistQueue();
  }, 50);
}

function getHub(): WarehouseHub {
  if (!globalThis.__kargobinHub) {
    globalThis.__kargobinHub = {
      state: loadStateFromDisk(),
      subscribers: new Set<Subscriber>(),
      sessions: new Map<string, ActiveSession>(),
      initialized: true,
      persistTimer: null,
      persisting: false,
      persistQueued: false,
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
  if (hub.subscribers.size === 0) return;
  const chunk = encodeSseEvent(event);
  for (const sub of hub.subscribers) {
    try {
      sub(chunk);
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

  if (sessionInfo?.clientId) {
    const operator =
      hub.state.operators.find((o) => o.id === sessionInfo.operatorId && o.active) ??
      hub.state.operators.find((o) => o.active) ??
      hub.state.operators[0];
    hub.sessions.set(sessionInfo.clientId, {
      clientId: sessionInfo.clientId,
      operatorId: operator?.id ?? 'op-guest',
      operatorName: operator?.name ?? 'Workspace User',
      operatorRole: operator?.role ?? 'Operator',
      connectedAt: new Date().toISOString(),
    });
    broadcast({
      type: 'presence:update',
      activeSessions: Array.from(hub.sessions.values()),
    });
  }

  hub.subscribers.add(subscriber);

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

export function updateSessionOperator(
  clientId: string,
  operatorId: string
): ActiveSession[] {
  const hub = getHub();
  const operator =
    hub.state.operators.find((o) => o.id === operatorId && o.active) ??
    hub.state.operators.find((o) => o.active) ??
    hub.state.operators[0];
  if (clientId) {
    const existing = hub.sessions.get(clientId);
    hub.sessions.set(clientId, {
      clientId,
      operatorId: operator?.id ?? 'op-guest',
      operatorName: operator?.name ?? 'Workspace User',
      operatorRole: operator?.role ?? 'Operator',
      connectedAt: existing?.connectedAt ?? new Date().toISOString(),
    });
    const activeSessions = Array.from(hub.sessions.values());
    broadcast({
      type: 'presence:update',
      activeSessions,
    });
    return activeSessions;
  }
  return Array.from(hub.sessions.values());
}

const GUEST_OPERATOR: Operator = {
  id: 'op-guest',
  name: 'Workspace User',
  badgeCode: 'USR-000',
  role: 'Admin',
  active: true,
  createdAt: '2026-11-24T00:00:00.000Z',
};

function resolveOperator(operatorId?: string): Operator {
  const hub = getHub();
  return (
    hub.state.operators.find((o) => o.id === operatorId && o.active) ??
    hub.state.operators.find((o) => o.active) ??
    hub.state.operators[0] ??
    GUEST_OPERATOR
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
  scheduleDiskPersist();
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
  updates: { name?: string; badgeCode?: string; role?: OperatorRole; active?: boolean },
  actorId?: string
): { ok: true; data: WarehouseSnapshotPayload } | { ok: false; status: number; error: string } {
  const hub = getHub();
  const target = hub.state.operators.find((o) => o.id === id);
  if (!target) {
    return { ok: false, status: 404, error: 'Operator not found.' };
  }

  const nextName = updates.name !== undefined ? updates.name.trim() : target.name;
  if (!nextName || nextName.length < 2 || nextName.length > 50) {
    return { ok: false, status: 400, error: 'Operator name must be between 2 and 50 characters.' };
  }

  const nextBadge =
    updates.badgeCode !== undefined ? normalizeCode(updates.badgeCode) : target.badgeCode;
  if (!nextBadge || nextBadge.length < 3 || nextBadge.length > 16) {
    return { ok: false, status: 400, error: 'Badge code must be 3–16 characters (e.g. OP-120).' };
  }
  if (
    hub.state.operators.some(
      (o) => o.id !== id && o.badgeCode.toUpperCase() === nextBadge
    )
  ) {
    return { ok: false, status: 409, error: `Badge code "${nextBadge}" is already assigned.` };
  }

  const validRoles: OperatorRole[] = ['Admin', 'Supervisor', 'Operator'];
  const nextRole = updates.role ?? target.role;
  if (!validRoles.includes(nextRole)) {
    return { ok: false, status: 400, error: 'Invalid operator role.' };
  }

  const actor = resolveOperator(actorId);
  const updated: Operator = {
    ...target,
    name: nextName,
    badgeCode: nextBadge,
    role: nextRole,
    active: updates.active ?? target.active,
  };

  for (const [cid, session] of hub.sessions.entries()) {
    if (session.operatorId === id) {
      hub.sessions.set(cid, {
        ...session,
        operatorName: updated.name,
        operatorRole: updated.role,
      });
    }
  }

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

export function deleteOperatorRecord(
  id: string,
  actorId?: string
): { ok: true; data: WarehouseSnapshotPayload } | { ok: false; status: number; error: string } {
  const hub = getHub();
  const target = hub.state.operators.find((o) => o.id === id);
  if (!target) {
    return { ok: false, status: 404, error: 'Operator not found.' };
  }

  const actor = resolveOperator(actorId);
  const remaining = hub.state.operators.filter((o) => o.id !== id);
  const fallback = remaining[0];
  for (const [cid, session] of hub.sessions.entries()) {
    if (session.operatorId === id) {
      hub.sessions.set(cid, {
        ...session,
        operatorId: fallback?.id ?? 'op-guest',
        operatorName: fallback?.name ?? 'Workspace User',
        operatorRole: fallback?.role ?? 'Operator',
      });
    }
  }

  const data = commitMutation(
    {
      ...hub.state,
      operators: remaining,
    },
    {
      action: 'operator:deleted',
      actorName: actor.name,
      summary: `${actor.name} removed user ${target.name} (${target.badgeCode})`,
    }
  );

  return { ok: true, data };
}

export function createFileRecord(
  input: SharedFileInput,
  operatorId?: string
): { ok: true; data: WarehouseSnapshotPayload; file: SharedFile } | { ok: false; status: number; error: string } {
  const hub = getHub();
  const validation = validateFileInput(input, hub.state.files);
  if (!validation.ok || !validation.value) {
    return { ok: false, status: 400, error: validation.error ?? 'Invalid file input.' };
  }

  const actor = resolveOperator(operatorId);
  const now = new Date().toISOString();
  const file: SharedFile = {
    id: `file-${crypto.randomUUID().slice(0, 8)}`,
    name: validation.value.name,
    folder: validation.value.folder,
    content: validation.value.content,
    revision: 1,
    updatedAt: now,
    updatedBy: actor.name,
    updatedById: actor.id,
  };

  const movement: Movement = {
    id: `mov-${crypto.randomUUID().slice(0, 8)}`,
    type: 'FILE_CREATED',
    materialId: file.id,
    trackingCode: `FILE:${file.name}`,
    materialName: file.name,
    sectionCode: file.folder,
    delta: 0,
    newQuantity: file.revision,
    operatorId: actor.id,
    operatorName: actor.name,
    operatorRole: actor.role,
    note: `Created shared file in ${file.folder} (rev 1)`,
    timestamp: now,
  };

  const data = commitMutation(
    {
      ...hub.state,
      files: [file, ...hub.state.files],
      movements: [movement, ...hub.state.movements],
    },
    {
      action: 'file:created',
      actorName: actor.name,
      summary: `${actor.name} created file ${file.name} (${file.folder})`,
    }
  );

  return { ok: true, data, file };
}

export function updateFileRecord(
  id: string,
  input: SharedFileInput,
  operatorId?: string
): { ok: true; data: WarehouseSnapshotPayload; file: SharedFile } | { ok: false; status: number; error: string } {
  const hub = getHub();
  const existing = hub.state.files.find((f) => f.id === id);
  if (!existing) {
    return { ok: false, status: 404, error: 'File not found.' };
  }

  const validation = validateFileInput(input, hub.state.files, id);
  if (!validation.ok || !validation.value) {
    return { ok: false, status: 400, error: validation.error ?? 'Invalid file input.' };
  }

  const actor = resolveOperator(operatorId);
  const now = new Date().toISOString();
  const updated: SharedFile = {
    ...existing,
    name: validation.value.name,
    folder: validation.value.folder,
    content: validation.value.content,
    revision: existing.revision + 1,
    updatedAt: now,
    updatedBy: actor.name,
    updatedById: actor.id,
  };

  const movement: Movement = {
    id: `mov-${crypto.randomUUID().slice(0, 8)}`,
    type: 'FILE_UPDATED',
    materialId: updated.id,
    trackingCode: `FILE:${updated.name}`,
    materialName: updated.name,
    sectionCode: updated.folder,
    previousSectionCode: existing.folder !== updated.folder ? existing.folder : undefined,
    delta: 0,
    newQuantity: updated.revision,
    operatorId: actor.id,
    operatorName: actor.name,
    operatorRole: actor.role,
    note: `Saved revision ${updated.revision} (${updated.content.length} chars)`,
    timestamp: now,
  };

  const data = commitMutation(
    {
      ...hub.state,
      files: hub.state.files.map((f) => (f.id === id ? updated : f)),
      movements: [movement, ...hub.state.movements],
    },
    {
      action: 'file:updated',
      actorName: actor.name,
      summary: `${actor.name} saved ${updated.name} (rev ${updated.revision})`,
    }
  );

  return { ok: true, data, file: updated };
}

export function deleteFileRecord(
  id: string,
  operatorId?: string
): { ok: true; data: WarehouseSnapshotPayload } | { ok: false; status: number; error: string } {
  const hub = getHub();
  const existing = hub.state.files.find((f) => f.id === id);
  if (!existing) {
    return { ok: false, status: 404, error: 'File not found.' };
  }

  const actor = resolveOperator(operatorId);
  const now = new Date().toISOString();
  const movement: Movement = {
    id: `mov-${crypto.randomUUID().slice(0, 8)}`,
    type: 'FILE_DELETED',
    materialId: existing.id,
    trackingCode: `FILE:${existing.name}`,
    materialName: existing.name,
    sectionCode: existing.folder,
    delta: 0,
    newQuantity: 0,
    operatorId: actor.id,
    operatorName: actor.name,
    operatorRole: actor.role,
    note: `Deleted file ${existing.name}`,
    timestamp: now,
  };

  const data = commitMutation(
    {
      ...hub.state,
      files: hub.state.files.filter((f) => f.id !== id),
      movements: [movement, ...hub.state.movements],
    },
    {
      action: 'file:deleted',
      actorName: actor.name,
      summary: `${actor.name} deleted file ${existing.name}`,
    }
  );

  return { ok: true, data };
}

export function bulkMaterialsAction(
  params: {
    ids: string[];
    action: 'transfer' | 'delete';
    targetSectionId?: string;
  },
  operatorId?: string
): { ok: true; data: WarehouseSnapshotPayload } | { ok: false; status: number; error: string } {
  const hub = getHub();
  const idSet = new Set(params.ids);
  const matched = hub.state.materials.filter((m) => idSet.has(m.id));
  if (matched.length === 0) {
    return { ok: false, status: 400, error: 'Select at least one material.' };
  }

  const actor = resolveOperator(operatorId);
  const now = new Date().toISOString();

  if (params.action === 'delete') {
    const data = commitMutation(
      {
        ...hub.state,
        materials: hub.state.materials.filter((m) => !idSet.has(m.id)),
      },
      {
        action: 'material:bulk-deleted',
        actorName: actor.name,
        summary: `${actor.name} deleted ${matched.length} material(s)`,
      }
    );
    return { ok: true, data };
  }

  const targetSec = hub.state.sections.find((s) => s.id === params.targetSectionId);
  if (!targetSec) {
    return { ok: false, status: 404, error: 'Target section not found.' };
  }

  const secLookup = new Map(hub.state.sections.map((s) => [s.id, s.code]));
  const newMovements: Movement[] = [];
  const nextMaterials = hub.state.materials.map((m) => {
    if (!idSet.has(m.id) || m.sectionId === targetSec.id) return m;
    const prevCode = secLookup.get(m.sectionId) ?? '?';
    newMovements.push({
      id: `mov-${crypto.randomUUID().slice(0, 8)}`,
      type: 'TRANSFER',
      materialId: m.id,
      trackingCode: m.trackingCode,
      materialName: m.name,
      sectionCode: targetSec.code,
      previousSectionCode: prevCode,
      delta: 0,
      newQuantity: m.quantity,
      operatorId: actor.id,
      operatorName: actor.name,
      operatorRole: actor.role,
      note: `Bulk moved ${prevCode} -> ${targetSec.code}`,
      timestamp: now,
    });
    return {
      ...m,
      sectionId: targetSec.id,
      updatedAt: now,
      updatedBy: actor.name,
    };
  });

  if (newMovements.length === 0) {
    return { ok: false, status: 400, error: `Selected materials are already in ${targetSec.code}.` };
  }

  const data = commitMutation(
    {
      ...hub.state,
      materials: nextMaterials,
      movements: [...newMovements, ...hub.state.movements],
    },
    {
      action: 'material:bulk-transferred',
      actorName: actor.name,
      summary: `${actor.name} moved ${newMovements.length} material(s) to ${targetSec.code}`,
    }
  );

  return { ok: true, data };
}

export function clearAllWarehouseData(
  options: { includeOperators: boolean },
  operatorId?: string
): WarehouseSnapshotPayload {
  const hub = getHub();
  const actor = resolveOperator(operatorId);
  const nextOperators = options.includeOperators ? [] : hub.state.operators;

  if (options.includeOperators) {
    for (const [cid, session] of hub.sessions.entries()) {
      hub.sessions.set(cid, {
        ...session,
        operatorId: 'op-guest',
        operatorName: 'Workspace User',
        operatorRole: 'Operator',
      });
    }
  }

  return commitMutation(
    {
      version: hub.state.version,
      sections: [],
      materials: [],
      operators: nextOperators,
      movements: [],
      files: [],
    },
    {
      action: 'warehouse:cleared',
      actorName: actor.name,
      summary: options.includeOperators
        ? `${actor.name} cleared all warehouse data and user accounts`
        : `${actor.name} cleared all sections, materials, files, and logs`,
    }
  );
}
