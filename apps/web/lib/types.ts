export interface RegistrationWithRelations {
  id: string;
  vehicleId: string;
  concessionaireId: string;
  status: string;
  protocol: string | null;
  sentAt: Date | null;
  approvedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  vehicle: {
    id: string;
    plate: string;
    renavam: string;
    category: string;
    type: string;
    crlvUrl: string | null;
    account: {
      id: string;
      name: string;
      cnpj: string;
      responsibleName: string;
      responsibleEmail: string;
      responsiblePhone: string;
    };
  };
  concessionaire: {
    id: string;
    name: string;
    cnpj: string;
    email: string;
    phone: string;
    website?: string;
    city: string;
    state: string;
  };
}

export type SendRegistrationMethod = 'email' | 'rpa' | 'portal';

export interface SendRegistrationResult {
  registrationId: string;
  method: SendRegistrationMethod;
  success: boolean;
  message: string;
  timestamp: Date;
  retryCount?: number;
}
