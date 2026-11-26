export type OperatorRole = 'Admin' | 'Supervisor' | 'Operator';

export type StockStatus = 'nominal' | 'low' | 'out';

export type MovementType =
  | 'INBOUND'
  | 'OUTBOUND'
  | 'TRANSFER'
  | 'ADJUST'
  | 'CREATED'
  | 'UPDATED'
  | 'FILE_CREATED'
  | 'FILE_UPDATED'
  | 'FILE_DELETED'
  | 'DATA_CLEARED';

export interface Operator {
  id: string;
  name: string;
  badgeCode: string;
  role: OperatorRole;
  active: boolean;
  createdAt: string;
}

export interface ActiveSession {
  clientId: string;
  operatorId: string;
  operatorName: string;
  operatorRole: OperatorRole;
  connectedAt: string;
}

export interface Section {
  id: string;
  code: string;
  name: string;
  zone: string;
  capacity: number;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface Material {
  id: string;
  trackingCode: string;
  name: string;
  category: string;
  sectionId: string;
  quantity: number;
  unit: string;
  minThreshold: number;
  lotNumber: string;
  updatedAt: string;
  updatedBy: string;
}

export interface SharedFile {
  id: string;
  name: string;
  folder: string;
  content: string;
  revision: number;
  updatedAt: string;
  updatedBy: string;
  updatedById: string;
}

export interface Movement {
  id: string;
  type: MovementType;
  materialId: string;
  trackingCode: string;
  materialName: string;
  sectionCode: string;
  previousSectionCode?: string;
  delta: number;
  newQuantity: number;
  operatorId: string;
  operatorName: string;
  operatorRole: OperatorRole;
  note: string;
  timestamp: string;
}

export interface WarehouseState {
  version: number;
  sections: Section[];
  materials: Material[];
  operators: Operator[];
  movements: Movement[];
  files: SharedFile[];
}

export interface WarehouseSnapshotPayload {
  state: WarehouseState;
  activeSessions: ActiveSession[];
}

export type StreamEvent =
  | {
      type: 'init';
      state: WarehouseState;
      activeSessions: ActiveSession[];
    }
  | {
      type: 'state:sync';
      state: WarehouseState;
      activeSessions: ActiveSession[];
      lastEvent?: {
        action: string;
        actorName: string;
        summary: string;
      };
    }
  | {
      type: 'presence:update';
      activeSessions: ActiveSession[];
    };
