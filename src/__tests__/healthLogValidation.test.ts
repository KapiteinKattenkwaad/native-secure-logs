import {
  validateHealthLogData,
  validateUpdateHealthLogData,
  sanitizeHealthLogData
} from '../utils/healthLogValidation';
import { CreateHealthLogData, UpdateHealthLogData } from '../types';

describe('healthLogValidation', () => {
  const validHealthLogData: CreateHealthLogData = {
    title: 'Test Health Log',
    description: 'This is a test health log description',
    category: 'symptom',
    severity: 3,
    tags: ['test', 'symptom'],
    date: '2024-01-15T10:00:00.000Z',
    notes: 'Some additional notes',
    attachments: ['attachment1.jpg']
  };

  describe('validateHealthLogData', () => {
    it('should validate correct health log data', () => {
      const result = validateHealthLogData(validHealthLogData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate minimal required data', () => {
      const minimalData: CreateHealthLogData = {
        title: 'Minimal Log',
        description: 'Minimal description',
        category: 'other',
        tags: [],
        date: '2024-01-15T10:00:00.000Z'
      };
      
      const result = validateHealthLogData(minimalData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    describe('title validation', () => {
      it('should reject missing title', () => {
        const data = { ...validHealthLogData, title: undefined as any };
        const result = validateHealthLogData(data);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'title',
          message: 'Title is required and must be a string'
        });
      });

      it('should reject empty title', () => {
        const data = { ...validHealthLogData, title: '   ' };
        const result = validateHealthLogData(data);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'title',
          message: 'Title cannot be empty'
        });
      });

      it('should reject title that is too long', () => {
        const data = { ...validHealthLogData, title: 'a'.repeat(201) };
        const result = validateHealthLogData(data);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'title',
          message: 'Title must be 200 characters or less'
        });
      });
    });

    describe('description validation', () => {
      it('should reject missing description', () => {
        const data = { ...validHealthLogData, description: undefined as any };
        const result = validateHealthLogData(data);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'description',
          message: 'Description is required and must be a string'
        });
      });

      it('should reject empty description', () => {
        const data = { ...validHealthLogData, description: '   ' };
        const result = validateHealthLogData(data);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'description',
          message: 'Description cannot be empty'
        });
      });

      it('should reject description that is too long', () => {
        const data = { ...validHealthLogData, description: 'a'.repeat(2001) };
        const result = validateHealthLogData(data);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'description',
          message: 'Description must be 2000 characters or less'
        });
      });
    });

    describe('category validation', () => {
      it('should accept valid categories', () => {
        const categories = ['symptom', 'medication', 'appointment', 'measurement', 'other'];
        
        categories.forEach(category => {
          const data = { ...validHealthLogData, category: category as any };
          const result = validateHealthLogData(data);
          expect(result.isValid).toBe(true);
        });
      });

      it('should reject invalid category', () => {
        const data = { ...validHealthLogData, category: 'invalid' as any };
        const result = validateHealthLogData(data);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'category',
          message: 'Category must be one of: symptom, medication, appointment, measurement, other'
        });
      });

      it('should reject missing category', () => {
        const data = { ...validHealthLogData, category: undefined as any };
        const result = validateHealthLogData(data);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'category',
          message: 'Category is required and must be a string'
        });
      });
    });

    describe('severity validation', () => {
      it('should accept valid severity levels', () => {
        const severityLevels = [1, 2, 3, 4, 5];
        
        severityLevels.forEach(severity => {
          const data = { ...validHealthLogData, severity: severity as any };
          const result = validateHealthLogData(data);
          expect(result.isValid).toBe(true);
        });
      });

      it('should accept undefined severity', () => {
        const data = { ...validHealthLogData, severity: undefined };
        const result = validateHealthLogData(data);
        expect(result.isValid).toBe(true);
      });

      it('should reject invalid severity levels', () => {
        const invalidSeverities = [0, 6, -1, 3.5, 'high'];
        
        invalidSeverities.forEach(severity => {
          const data = { ...validHealthLogData, severity: severity as any };
          const result = validateHealthLogData(data);
          expect(result.isValid).toBe(false);
          expect(result.errors).toContainEqual({
            field: 'severity',
            message: 'Severity must be a number between 1 and 5'
          });
        });
      });
    });

    describe('tags validation', () => {
      it('should accept valid tags array', () => {
        const data = { ...validHealthLogData, tags: ['tag1', 'tag2', 'tag3'] };
        const result = validateHealthLogData(data);
        expect(result.isValid).toBe(true);
      });

      it('should accept empty tags array', () => {
        const data = { ...validHealthLogData, tags: [] };
        const result = validateHealthLogData(data);
        expect(result.isValid).toBe(true);
      });

      it('should reject non-array tags', () => {
        const data = { ...validHealthLogData, tags: 'not-an-array' as any };
        const result = validateHealthLogData(data);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'tags',
          message: 'Tags must be an array'
        });
      });

      it('should reject non-string tags', () => {
        const data = { ...validHealthLogData, tags: ['valid', 123, 'also-valid'] as any };
        const result = validateHealthLogData(data);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'tags',
          message: 'Tag at index 1 must be a string'
        });
      });

      it('should reject empty string tags', () => {
        const data = { ...validHealthLogData, tags: ['valid', '   ', 'also-valid'] };
        const result = validateHealthLogData(data);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'tags',
          message: 'Tag at index 1 cannot be empty'
        });
      });

      it('should reject tags that are too long', () => {
        const data = { ...validHealthLogData, tags: ['valid', 'a'.repeat(51)] };
        const result = validateHealthLogData(data);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'tags',
          message: 'Tag at index 1 must be 50 characters or less'
        });
      });
    });

    describe('date validation', () => {
      it('should accept valid ISO date string', () => {
        const data = { ...validHealthLogData, date: '2024-01-15T10:00:00.000Z' };
        const result = validateHealthLogData(data);
        expect(result.isValid).toBe(true);
      });

      it('should reject missing date', () => {
        const data = { ...validHealthLogData, date: undefined as any };
        const result = validateHealthLogData(data);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'date',
          message: 'Date is required and must be a string'
        });
      });

      it('should reject invalid date string', () => {
        const data = { ...validHealthLogData, date: 'invalid-date' };
        const result = validateHealthLogData(data);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'date',
          message: 'Date must be a valid ISO date string'
        });
      });

      it('should reject future dates', () => {
        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);
        const data = { ...validHealthLogData, date: futureDate.toISOString() };
        const result = validateHealthLogData(data);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'date',
          message: 'Date cannot be in the future'
        });
      });
    });

    describe('notes validation', () => {
      it('should accept valid notes', () => {
        const data = { ...validHealthLogData, notes: 'Some notes here' };
        const result = validateHealthLogData(data);
        expect(result.isValid).toBe(true);
      });

      it('should accept undefined notes', () => {
        const data = { ...validHealthLogData, notes: undefined };
        const result = validateHealthLogData(data);
        expect(result.isValid).toBe(true);
      });

      it('should reject non-string notes', () => {
        const data = { ...validHealthLogData, notes: 123 as any };
        const result = validateHealthLogData(data);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'notes',
          message: 'Notes must be a string'
        });
      });

      it('should reject notes that are too long', () => {
        const data = { ...validHealthLogData, notes: 'a'.repeat(5001) };
        const result = validateHealthLogData(data);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'notes',
          message: 'Notes must be 5000 characters or less'
        });
      });
    });

    describe('attachments validation', () => {
      it('should accept valid attachments array', () => {
        const data = { ...validHealthLogData, attachments: ['file1.jpg', 'file2.pdf'] };
        const result = validateHealthLogData(data);
        expect(result.isValid).toBe(true);
      });

      it('should accept undefined attachments', () => {
        const data = { ...validHealthLogData, attachments: undefined };
        const result = validateHealthLogData(data);
        expect(result.isValid).toBe(true);
      });

      it('should reject non-array attachments', () => {
        const data = { ...validHealthLogData, attachments: 'not-an-array' as any };
        const result = validateHealthLogData(data);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'attachments',
          message: 'Attachments must be an array'
        });
      });

      it('should reject non-string attachments', () => {
        const data = { ...validHealthLogData, attachments: ['valid.jpg', 123] as any };
        const result = validateHealthLogData(data);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'attachments',
          message: 'Attachment at index 1 must be a string'
        });
      });

      it('should reject empty string attachments', () => {
        const data = { ...validHealthLogData, attachments: ['valid.jpg', '   '] };
        const result = validateHealthLogData(data);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'attachments',
          message: 'Attachment at index 1 cannot be empty'
        });
      });
    });
  });

  describe('validateUpdateHealthLogData', () => {
    const validUpdateData: UpdateHealthLogData = {
      id: 'health_log_123',
      title: 'Updated Title'
    };

    it('should validate correct update data', () => {
      const result = validateUpdateHealthLogData(validUpdateData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require ID for updates', () => {
      const data = { ...validUpdateData, id: undefined as any };
      const result = validateUpdateHealthLogData(data);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'id',
        message: 'ID is required for updates and must be a string'
      });
    });

    it('should reject empty ID', () => {
      const data = { ...validUpdateData, id: '   ' };
      const result = validateUpdateHealthLogData(data);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'id',
        message: 'ID cannot be empty'
      });
    });

    it('should validate only provided fields', () => {
      const data: UpdateHealthLogData = {
        id: 'health_log_123',
        title: 'Valid Title',
        category: 'invalid' as any // This should cause validation error
      };
      
      const result = validateUpdateHealthLogData(data);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'category',
        message: 'Category must be one of: symptom, medication, appointment, measurement, other'
      });
    });
  });

  describe('sanitizeHealthLogData', () => {
    it('should trim whitespace from string fields', () => {
      const data: CreateHealthLogData = {
        title: '  Test Title  ',
        description: '  Test Description  ',
        category: 'symptom',
        tags: ['  tag1  ', '  tag2  ', ''],
        date: '2024-01-15T10:00:00.000Z',
        notes: '  Some notes  ',
        attachments: ['  file1.jpg  ', '  file2.pdf  ', '']
      };

      const sanitized = sanitizeHealthLogData(data);

      expect(sanitized.title).toBe('Test Title');
      expect(sanitized.description).toBe('Test Description');
      expect(sanitized.tags).toEqual(['tag1', 'tag2']);
      expect(sanitized.notes).toBe('Some notes');
      expect(sanitized.attachments).toEqual(['file1.jpg', 'file2.pdf']);
    });

    it('should filter out empty tags and attachments', () => {
      const data: CreateHealthLogData = {
        title: 'Test Title',
        description: 'Test Description',
        category: 'symptom',
        tags: ['valid', '', '   ', 'also-valid'],
        date: '2024-01-15T10:00:00.000Z',
        attachments: ['valid.jpg', '', '   ', 'also-valid.pdf']
      };

      const sanitized = sanitizeHealthLogData(data);

      expect(sanitized.tags).toEqual(['valid', 'also-valid']);
      expect(sanitized.attachments).toEqual(['valid.jpg', 'also-valid.pdf']);
    });

    it('should handle undefined optional fields', () => {
      const data: CreateHealthLogData = {
        title: 'Test Title',
        description: 'Test Description',
        category: 'symptom',
        tags: ['tag1'],
        date: '2024-01-15T10:00:00.000Z',
        notes: undefined,
        attachments: undefined
      };

      const sanitized = sanitizeHealthLogData(data);

      expect(sanitized.notes).toBeUndefined();
      expect(sanitized.attachments).toBeUndefined();
    });
  });
});