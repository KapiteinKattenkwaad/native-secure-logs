export type HealthLogCategory = 'symptom' | 'medication' | 'appointment' | 'measurement' | 'other';

export type SeverityLevel = 1 | 2 | 3 | 4 | 5;

export interface HealthLog {
  id: string;
  title: string;
  description: string;
  category: HealthLogCategory;
  severity?: SeverityLevel;
  tags: string[];
  date: string; // ISO date string
  notes?: string;
  attachments?: string[];
}

export interface CreateHealthLogData {
  title: string;
  description: string;
  category: HealthLogCategory;
  severity?: SeverityLevel;
  tags: string[];
  date: string;
  notes?: string;
  attachments?: string[];
}

export interface UpdateHealthLogData extends Partial<CreateHealthLogData> {
  id: string;
}

export interface HealthLogValidationError {
  field: string;
  message: string;
}

export interface HealthLogValidationResult {
  isValid: boolean;
  errors: HealthLogValidationError[];
}

export interface EncryptedHealthLog {
  id: string;
  userId: string;
  encryptedData: string;
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
  cloudId?: string;
}