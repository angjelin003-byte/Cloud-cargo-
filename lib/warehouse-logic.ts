import type { Material, Section, StockStatus } from './types';

export interface ValidationResult<T> {
  ok: boolean;
  error?: string;
  value?: T;
}

export interface SectionInput {
  code: string;
  name: string;
  zone: string;
  capacity: number;
  description?: string;
}

export interface MaterialInput {
  trackingCode: string;
  name: string;
  category: string;
  sectionId: string;
  quantity: number;
  unit: string;
  minThreshold: number;
  lotNumber?: string;
}

export interface MaterialFilters {
  query: string;
  sectionId: string | 'all';
  status: StockStatus | 'all';
  sortBy: 'trackingCode' | 'name' | 'quantity' | 'updatedAt';
  sortDir: 'asc' | 'desc';
}

export interface WarehouseMetrics {
  totalSkus: number;
  totalUnits: number;
  activeSections: number;
  lowStockCount: number;
  outOfStockCount: number;
  alertCount: number;
}

/**
 * Normalizes a section or tracking code into uppercase alphanumeric + hyphen format.
 */
export function normalizeCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Computes semantic stock status from quantity and minimum threshold.
 */
export function getStockStatus(quantity: number, minThreshold: number): StockStatus {
  if (quantity <= 0) return 'out';
  if (quantity <= minThreshold) return 'low';
  return 'nominal';
}

/**
 * Validates and normalizes section input, ensuring unique section codes.
 */
export function validateSectionInput(
  input: SectionInput,
  existingSections: Section[],
  editingId?: string
): ValidationResult<SectionInput> {
  const code = normalizeCode(input.code);
  const name = input.name.trim();
  const zone = input.zone.trim();
  const description = (input.description ?? '').trim();
  const capacity = Number(input.capacity);

  if (!code || code.length < 2 || code.length > 16) {
    return {
      ok: false,
      error: 'Section code must be 2–16 alphanumeric characters (e.g. A-01, COLD-2).',
    };
  }

  if (!/^[A-Z0-9][A-Z0-9-]{1,15}$/.test(code)) {
    return {
      ok: false,
      error: 'Section code must start with a letter or digit and use only A–Z, 0–9, or hyphens.',
    };
  }

  const duplicate = existingSections.find(
    (s) => s.code.toUpperCase() === code && s.id !== editingId
  );
  if (duplicate) {
    return {
      ok: false,
      error: `Section code "${code}" is already assigned to "${duplicate.name}".`,
    };
  }

  if (!name || name.length < 2 || name.length > 60) {
    return {
      ok: false,
      error: 'Section name must be between 2 and 60 characters.',
    };
  }

  if (!zone || zone.length > 32) {
    return {
      ok: false,
      error: 'Zone / Aisle is required (max 32 characters).',
    };
  }

  if (!Number.isFinite(capacity) || !Number.isInteger(capacity) || capacity < 1 || capacity > 100000) {
    return {
      ok: false,
      error: 'Capacity must be a whole number between 1 and 100,000.',
    };
  }

  return {
    ok: true,
    value: {
      code,
      name,
      zone,
      capacity,
      description: description.slice(0, 160),
    },
  };
}

/**
 * Generates a collision-free tracking code derived from the section code and material name.
 */
export function generateTrackingCode(
  sectionCode: string,
  materialName: string,
  existingMaterials: Material[]
): string {
  const cleanSection = normalizeCode(sectionCode).replace(/-/g, '').slice(0, 5) || 'WH';
  const letters = materialName
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  let stem = 'MAT';
  if (letters.length >= 2) {
    stem = (letters[0].slice(0, 2) + letters[1].slice(0, 1)).slice(0, 3);
  } else if (letters.length === 1) {
    stem = letters[0].slice(0, 3).padEnd(2, 'X');
  }

  const used = new Set(existingMaterials.map((m) => m.trackingCode.toUpperCase()));
  for (let seq = 1; seq <= 9999; seq++) {
    const candidate = `${cleanSection}-${stem}-${String(seq).padStart(3, '0')}`;
    if (!used.has(candidate)) {
      return candidate;
    }
  }
  return `${cleanSection}-${stem}-${Date.now().toString().slice(-4)}`;
}

/**
 * Validates material input, enforcing unique tracking code and valid section reference.
 */
export function validateMaterialInput(
  input: MaterialInput,
  sections: Section[],
  existingMaterials: Material[],
  editingId?: string
): ValidationResult<MaterialInput> {
  const trackingCode = normalizeCode(input.trackingCode);
  const name = input.name.trim();
  const category = input.category.trim();
  const unit = input.unit.trim();
  const lotNumber = (input.lotNumber ?? '').trim().toUpperCase();
  const quantity = Number(input.quantity);
  const minThreshold = Number(input.minThreshold);

  if (!trackingCode || trackingCode.length < 4 || trackingCode.length > 24) {
    return {
      ok: false,
      error: 'Tracking code must be 4–24 characters (e.g. A01-STL-001).',
    };
  }

  const dupCode = existingMaterials.find(
    (m) => m.trackingCode.toUpperCase() === trackingCode && m.id !== editingId
  );
  if (dupCode) {
    return {
      ok: false,
      error: `Tracking code "${trackingCode}" is already assigned to "${dupCode.name}".`,
    };
  }

  const targetSection = sections.find((s) => s.id === input.sectionId);
  if (!targetSection) {
    return {
      ok: false,
      error: 'Please select a valid warehouse section.',
    };
  }

  if (!name || name.length < 2 || name.length > 80) {
    return {
      ok: false,
      error: 'Material name must be between 2 and 80 characters.',
    };
  }

  if (!category || category.length > 40) {
    return {
      ok: false,
      error: 'Category is required (max 40 characters).',
    };
  }

  if (!unit || unit.length > 16) {
    return {
      ok: false,
      error: 'Unit of measure is required (e.g. pcs, kg, rolls).',
    };
  }

  if (!Number.isFinite(quantity) || quantity < 0 || !Number.isInteger(quantity)) {
    return {
      ok: false,
      error: 'Quantity must be a non-negative whole number.',
    };
  }

  if (!Number.isFinite(minThreshold) || minThreshold < 0 || !Number.isInteger(minThreshold)) {
    return {
      ok: false,
      error: 'Minimum threshold must be a non-negative whole number.',
    };
  }

  return {
    ok: true,
    value: {
      trackingCode,
      name,
      category,
      sectionId: targetSection.id,
      quantity,
      unit,
      minThreshold,
      lotNumber: lotNumber.slice(0, 24),
    },
  };
}

/**
 * Applies a stock delta or absolute count while guaranteeing quantity never drops below 0.
 */
export function applyStockDelta(
  currentQuantity: number,
  delta: number
): ValidationResult<{ newQuantity: number; delta: number }> {
  if (!Number.isFinite(delta) || !Number.isInteger(delta)) {
    return { ok: false, error: 'Quantity adjustment must be a whole number.' };
  }
  const next = currentQuantity + delta;
  if (next < 0) {
    return {
      ok: false,
      error: `Insufficient stock: available ${currentQuantity}, attempted change ${delta}.`,
    };
  }
  return {
    ok: true,
    value: {
      newQuantity: next,
      delta,
    },
  };
}

/**
 * Filters and sorts warehouse materials against search query (including tracking and section codes),
 * section selection, and stock status.
 */
export function filterAndSortMaterials(
  materials: Material[],
  sections: Section[],
  filters: MaterialFilters
): Material[] {
  const sectionMap = new Map(sections.map((s) => [s.id, s]));
  const q = filters.query.trim().toLowerCase();

  const filtered = materials.filter((item) => {
    if (filters.sectionId !== 'all' && item.sectionId !== filters.sectionId) {
      return false;
    }

    const status = getStockStatus(item.quantity, item.minThreshold);
    if (filters.status !== 'all' && status !== filters.status) {
      return false;
    }

    if (q) {
      const sec = sectionMap.get(item.sectionId);
      const haystack = [
        item.trackingCode,
        item.name,
        item.category,
        item.lotNumber,
        sec?.code ?? '',
        sec?.name ?? '',
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) {
        return false;
      }
    }

    return true;
  });

  const dir = filters.sortDir === 'asc' ? 1 : -1;
  return [...filtered].sort((a, b) => {
    switch (filters.sortBy) {
      case 'trackingCode':
        return a.trackingCode.localeCompare(b.trackingCode) * dir;
      case 'name':
        return a.name.localeCompare(b.name) * dir;
      case 'quantity':
        return (a.quantity - b.quantity) * dir;
      case 'updatedAt':
      default:
        return a.updatedAt.localeCompare(b.updatedAt) * dir;
    }
  });
}

/**
 * Computes summary metrics for the warehouse KPI strip.
 */
export function computeWarehouseMetrics(
  materials: Material[],
  sections: Section[]
): WarehouseMetrics {
  let totalUnits = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  for (const m of materials) {
    totalUnits += m.quantity;
    const status = getStockStatus(m.quantity, m.minThreshold);
    if (status === 'out') outOfStockCount += 1;
    else if (status === 'low') lowStockCount += 1;
  }

  return {
    totalSkus: materials.length,
    totalUnits,
    activeSections: sections.length,
    lowStockCount,
    outOfStockCount,
    alertCount: lowStockCount + outOfStockCount,
  };
}

/**
 * Generates deterministic bar widths for an inline Code-128 style visual tracking barcode SVG.
 */
export function buildBarcodePattern(code: string): number[] {
  const bars: number[] = [2, 1, 2]; // start guard
  for (let i = 0; i < code.length; i++) {
    const ch = code.charCodeAt(i);
    bars.push(((ch >> 0) & 1) + 1);
    bars.push(((ch >> 1) & 1) + 1);
    bars.push(((ch >> 2) & 1) + 1);
    bars.push(((ch >> 3) & 1) + 1);
  }
  bars.push(2, 1, 2); // stop guard
  return bars;
}
