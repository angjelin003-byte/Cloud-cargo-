import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCode,
  validateSectionInput,
  generateTrackingCode,
  validateMaterialInput,
  applyStockDelta,
  getStockStatus,
  filterAndSortMaterials,
  computeWarehouseMetrics,
} from './warehouse-logic';
import type { Material, Section } from './types';

const now = '2026-11-23T10:00:00.000Z';

const sampleSections: Section[] = [
  {
    id: 'sec-1',
    code: 'A-01',
    name: 'Raw Metals',
    zone: 'Zone A',
    capacity: 500,
    description: 'Aluminum and steel stock',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'sec-2',
    code: 'B-04',
    name: 'Fasteners',
    zone: 'Zone B',
    capacity: 1200,
    description: 'Bolts and washers',
    createdAt: now,
    updatedAt: now,
  },
];

const sampleMaterials: Material[] = [
  {
    id: 'mat-1',
    trackingCode: 'A01-ALU-001',
    name: 'Aluminum Sheet 6061',
    category: 'Metals',
    sectionId: 'sec-1',
    quantity: 42,
    unit: 'sheets',
    minThreshold: 15,
    lotNumber: 'LOT-88A',
    updatedAt: '2026-11-23T10:05:00.000Z',
    updatedBy: 'Elena Vance',
  },
  {
    id: 'mat-2',
    trackingCode: 'B04-HEX-001',
    name: 'Hex Bolt M8 Stainless',
    category: 'Fasteners',
    sectionId: 'sec-2',
    quantity: 8,
    unit: 'boxes',
    minThreshold: 10,
    lotNumber: 'LOT-12C',
    updatedAt: '2026-11-23T10:10:00.000Z',
    updatedBy: 'Marcus Chen',
  },
  {
    id: 'mat-3',
    trackingCode: 'B04-WSH-002',
    name: 'Spring Washer M8',
    category: 'Fasteners',
    sectionId: 'sec-2',
    quantity: 0,
    unit: 'boxes',
    minThreshold: 5,
    lotNumber: 'LOT-19D',
    updatedAt: '2026-11-23T10:12:00.000Z',
    updatedBy: 'Marcus Chen',
  },
];

test('normalizeCode cleans whitespace, lowercase, and special characters', () => {
  assert.equal(normalizeCode('  a 01 / raw '), 'A-01-RAW');
  assert.equal(normalizeCode('cold--02!@#'), 'COLD-02');
});

test('validateSectionInput rejects duplicate codes and accepts unique codes', () => {
  const dup = validateSectionInput(
    { code: 'a-01', name: 'Duplicate Zone', zone: 'Zone Z', capacity: 100 },
    sampleSections
  );
  assert.equal(dup.ok, false);
  assert.match(dup.error ?? '', /already assigned/i);

  const valid = validateSectionInput(
    { code: 'z-09', name: 'Cold Storage', zone: 'Zone Z', capacity: 250 },
    sampleSections
  );
  assert.equal(valid.ok, true);
  assert.equal(valid.value?.code, 'Z-09');
});

test('generateTrackingCode creates collision-free sequential codes', () => {
  const code = generateTrackingCode('A-01', 'Aluminum Bar', sampleMaterials);
  assert.equal(code, 'A01-ALB-001');

  const withExisting: Material[] = [
    ...sampleMaterials,
    { ...sampleMaterials[0], id: 'mat-99', trackingCode: 'A01-ALB-001' },
  ];
  const nextCode = generateTrackingCode('A-01', 'Aluminum Bar', withExisting);
  assert.equal(nextCode, 'A01-ALB-002');
});

test('validateMaterialInput prevents duplicate tracking codes and invalid sections', () => {
  const dup = validateMaterialInput(
    {
      trackingCode: 'A01-ALU-001',
      name: 'Copper Plate',
      category: 'Metals',
      sectionId: 'sec-1',
      quantity: 10,
      unit: 'sheets',
      minThreshold: 2,
    },
    sampleSections,
    sampleMaterials
  );
  assert.equal(dup.ok, false);

  const badSection = validateMaterialInput(
    {
      trackingCode: 'Z99-COP-001',
      name: 'Copper Plate',
      category: 'Metals',
      sectionId: 'sec-missing',
      quantity: 10,
      unit: 'sheets',
      minThreshold: 2,
    },
    sampleSections,
    sampleMaterials
  );
  assert.equal(badSection.ok, false);
});

test('applyStockDelta blocks negative resulting stock', () => {
  const bad = applyStockDelta(5, -6);
  assert.equal(bad.ok, false);
  assert.match(bad.error ?? '', /insufficient stock/i);

  const good = applyStockDelta(5, -5);
  assert.equal(good.ok, true);
  assert.equal(good.value?.newQuantity, 0);
});

test('getStockStatus and computeWarehouseMetrics calculate exact counts', () => {
  assert.equal(getStockStatus(42, 15), 'nominal');
  assert.equal(getStockStatus(8, 10), 'low');
  assert.equal(getStockStatus(0, 5), 'out');

  const metrics = computeWarehouseMetrics(sampleMaterials, sampleSections);
  assert.equal(metrics.totalSkus, 3);
  assert.equal(metrics.totalUnits, 50);
  assert.equal(metrics.activeSections, 2);
  assert.equal(metrics.lowStockCount, 1);
  assert.equal(metrics.outOfStockCount, 1);
  assert.equal(metrics.alertCount, 2);
});

test('filterAndSortMaterials matches tracking code and section code', () => {
  const byTracking = filterAndSortMaterials(sampleMaterials, sampleSections, {
    query: 'A01-ALU',
    sectionId: 'all',
    status: 'all',
    sortBy: 'trackingCode',
    sortDir: 'asc',
  });
  assert.equal(byTracking.length, 1);
  assert.equal(byTracking[0].id, 'mat-1');

  const bySectionCode = filterAndSortMaterials(sampleMaterials, sampleSections, {
    query: 'B-04',
    sectionId: 'all',
    status: 'low',
    sortBy: 'name',
    sortDir: 'asc',
  });
  assert.equal(bySectionCode.length, 1);
  assert.equal(bySectionCode[0].trackingCode, 'B04-HEX-001');
});
