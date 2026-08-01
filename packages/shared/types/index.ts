// Tipos de usuário
export enum UserRole {
  ADMIN = 'admin',
  OPERATOR = 'operator',
  VIEWER = 'viewer',
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  accountId?: string;
  createdAt: Date;
}

// Tipos de Conta (Órgão Público)
export enum AccountStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
}

export interface Account {
  id: string;
  name: string;
  cnpj: string;
  status: AccountStatus;
  responsibleName: string;
  responsibleEmail: string;
  responsiblePhone: string;
  address: string;
  city: string;
  state: string;
  createdAt: Date;
  updatedAt: Date;
}

// Tipos de Veículo
export enum VehicleType {
  PROPRIO = 'proprio',
  LOCADO = 'locado',
}

export enum VehicleCategory {
  OFICIAL = 'oficial',
  AMBULANCIA = 'ambulancia',
  BOMBEIRO = 'bombeiro',
  OUTRO = 'outro',
}

export enum VehicleStatus {
  RASCUNHO = 'rascunho',
  ENVIADO = 'enviado',
  AGUARDANDO = 'aguardando',
  APROVADO = 'aprovado',
  RECUSADO = 'recusado',
  VENCIDO = 'vencido',
}

export interface Vehicle {
  id: string;
  accountId: string;
  plate: string;
  renavam: string;
  type: VehicleType;
  category: VehicleCategory;
  status: VehicleStatus;
  documentUrl?: string;
  contractUrl?: string;
  crlvUrl?: string;
  tagSerialNumber?: string;
  expiresAt?: Date;
  lastRenewalAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Tipos de Alerta
export enum AlertType {
  EXPIRING_SOON = 'expiring_soon',
  EXPIRED = 'expired',
  RENEWAL_NEEDED = 'renewal_needed',
}

export interface Alert {
  id: string;
  vehicleId: string;
  type: AlertType;
  daysUntilExpiry: number;
  sentAt?: Date;
  createdAt: Date;
}

// Tipos de Status de Cadastro
export enum RegistrationStatus {
  DRAFT = 'rascunho',
  SENT = 'enviado',
  AWAITING_RESPONSE = 'aguardando_resposta',
  APPROVED = 'aprovado',
  REJECTED = 'recusado',
}

export interface ConcesssionaireRegistration {
  id: string;
  vehicleId: string;
  concessionnaire: string;
  status: RegistrationStatus;
  protocol?: string;
  sentAt?: Date;
  approvedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}
