import {
  CreateHealthLogData,
  UpdateHealthLogData,
  HealthLogValidationError,
  HealthLogValidationResult,
  HealthLogCategory,
  SeverityLevel
} from '../types';

const VALID_CATEGORIES: HealthLogCategory[] = ['symptom', 'medication', 'appointment', 'measurement', 'other'];
const VALID_SEVERITY_LEVELS: SeverityLevel[] = [1, 2, 3, 4, 5];

export function validateHealthLogData(data: CreateHealthLogData | UpdateHealthLogData): HealthLogValidationResult {
  const errors: HealthLogValidationError[] = [];

  // Validate title
  if (!data.title || typeof data.title !== 'string') {
    errors.push({ field: 'title', message: 'Title is required and must be a string' });
  } else if (data.title.trim().length === 0) {
    errors.push({ field: 'title', message: 'Title cannot be empty' });
  } else if (data.title.length > 200) {
    errors.push({ field: 'title', message: 'Title must be 200 characters or less' });
  }

  // Validate description
  if (!data.description || typeof data.description !== 'string') {
    errors.push({ field: 'description', message: 'Description is required and must be a string' });
  } else if (data.description.trim().length === 0) {
    errors.push({ field: 'description', message: 'Description cannot be empty' });
  } else if (data.description.length > 2000) {
    errors.push({ field: 'description', message: 'Description must be 2000 characters or less' });
  }

  // Validate category
  if (!data.category || typeof data.category !== 'string') {
    errors.push({ field: 'category', message: 'Category is required and must be a string' });
  } else if (!VALID_CATEGORIES.includes(data.category as HealthLogCategory)) {
    errors.push({ 
      field: 'category', 
      message: `Category must be one of: ${VALID_CATEGORIES.join(', ')}` 
    });
  }

  // Validate severity (optional)
  if (data.severity !== undefined) {
    if (typeof data.severity !== 'number' || !VALID_SEVERITY_LEVELS.includes(data.severity as SeverityLevel)) {
      errors.push({ 
        field: 'severity', 
        message: `Severity must be a number between 1 and 5` 
      });
    }
  }

  // Validate tags
  if (!Array.isArray(data.tags)) {
    errors.push({ field: 'tags', message: 'Tags must be an array' });
  } else {
    data.tags.forEach((tag, index) => {
      if (typeof tag !== 'string') {
        errors.push({ field: 'tags', message: `Tag at index ${index} must be a string` });
      } else if (tag.trim().length === 0) {
        errors.push({ field: 'tags', message: `Tag at index ${index} cannot be empty` });
      } else if (tag.length > 50) {
        errors.push({ field: 'tags', message: `Tag at index ${index} must be 50 characters or less` });
      }
    });
  }

  // Validate date
  if (!data.date || typeof data.date !== 'string') {
    errors.push({ field: 'date', message: 'Date is required and must be a string' });
  } else {
    const dateObj = new Date(data.date);
    if (isNaN(dateObj.getTime())) {
      errors.push({ field: 'date', message: 'Date must be a valid ISO date string' });
    } else if (dateObj > new Date()) {
      errors.push({ field: 'date', message: 'Date cannot be in the future' });
    }
  }

  // Validate notes (optional)
  if (data.notes !== undefined) {
    if (typeof data.notes !== 'string') {
      errors.push({ field: 'notes', message: 'Notes must be a string' });
    } else if (data.notes.length > 5000) {
      errors.push({ field: 'notes', message: 'Notes must be 5000 characters or less' });
    }
  }

  // Validate attachments (optional)
  if (data.attachments !== undefined) {
    if (!Array.isArray(data.attachments)) {
      errors.push({ field: 'attachments', message: 'Attachments must be an array' });
    } else {
      data.attachments.forEach((attachment, index) => {
        if (typeof attachment !== 'string') {
          errors.push({ field: 'attachments', message: `Attachment at index ${index} must be a string` });
        } else if (attachment.trim().length === 0) {
          errors.push({ field: 'attachments', message: `Attachment at index ${index} cannot be empty` });
        }
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function validateUpdateHealthLogData(data: UpdateHealthLogData): HealthLogValidationResult {
  const errors: HealthLogValidationError[] = [];

  // Validate ID is present for updates
  if (!data.id || typeof data.id !== 'string') {
    errors.push({ field: 'id', message: 'ID is required for updates and must be a string' });
  } else if (data.id.trim().length === 0) {
    errors.push({ field: 'id', message: 'ID cannot be empty' });
  }

  // Validate other fields using the main validation function
  const mainValidation = validateHealthLogData(data as CreateHealthLogData);
  
  // Only add validation errors for fields that are actually present in the update
  mainValidation.errors.forEach(error => {
    const fieldValue = (data as any)[error.field];
    if (fieldValue !== undefined) {
      errors.push(error);
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function sanitizeHealthLogData(data: CreateHealthLogData): CreateHealthLogData {
  return {
    title: data.title.trim(),
    description: data.description.trim(),
    category: data.category,
    severity: data.severity,
    tags: data.tags.map(tag => tag.trim()).filter(tag => tag.length > 0),
    date: data.date,
    notes: data.notes?.trim(),
    attachments: data.attachments?.map(attachment => attachment.trim()).filter(attachment => attachment.length > 0)
  };
}