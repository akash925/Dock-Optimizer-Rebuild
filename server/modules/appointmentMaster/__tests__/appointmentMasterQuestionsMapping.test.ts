import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AppointmentMasterService } from '../service';
import { camelToSnake, snakeToCamel } from '../../../../shared/utils/object-mapper';
import { getStorage } from '@/storage';

// Mock the storage
vi.mock('@/storage', () => ({
  getStorage: vi.fn()
}));

describe('AppointmentMasterService Questions Mapping', () => {
  let service: AppointmentMasterService;
  let mockStorage: any;

  beforeEach(() => {
    // Set up mock storage
    mockStorage = {
      getCustomQuestionsByAppointmentType: vi.fn(),
      deleteCustomQuestion: vi.fn(),
      createCustomQuestion: vi.fn(),
      getAppointmentType: vi.fn(),
      updateAppointmentType: vi.fn(),
    };

    // Mock the getStorage function
    vi.mocked(getStorage).mockResolvedValue(mockStorage);
    
    service = new AppointmentMasterService();
  });

  describe('camelCase to snake_case transformation', () => {
    it('should create appointment type with 3 questions, fetch it back, and deep-compare camelCase structure', async () => {
      const appointmentTypeId = 1;
      
      // Three test questions in camelCase format (frontend)
      const frontendQuestions = [
        {
          id: 1,
          label: 'Special Instructions',
          type: 'textarea',
          isRequired: true,
          placeholder: 'Enter special instructions...',
          orderPosition: 1,
          appointmentTypeId: appointmentTypeId,
          included: true
        },
        {
          id: 2,
          label: 'Hazmat Classification',
          type: 'select',
          isRequired: false,
          options: JSON.stringify(['Class 1', 'Class 2', 'Class 3']),
          orderPosition: 2,
          appointmentTypeId: appointmentTypeId,
          included: true
        },
        {
          id: 3,
          label: 'Emergency Contact',
          type: 'text',
          isRequired: true,
          placeholder: 'Phone number',
          orderPosition: 3,
          appointmentTypeId: appointmentTypeId,
          included: false
        }
      ];

      // Mock existing questions (empty)
      mockStorage.getCustomQuestionsByAppointmentType.mockResolvedValue([]);

      // Mock created questions in database format (snake_case)
      const dbQuestions = frontendQuestions.map(q => ({
        id: q.id,
        label: q.label,
        type: q.type,
        is_required: q.isRequired,
        placeholder: q.placeholder,
        options: q.options,
        order_position: q.orderPosition,
        appointment_type_id: q.appointmentTypeId,
        included: q.included,
        created_at: new Date(),
        last_modified_at: new Date()
      }));

      // Mock createCustomQuestion to return db format
      mockStorage.createCustomQuestion.mockImplementation((data: any) => {
        const question = dbQuestions.find(q => q.label === data.label);
        return Promise.resolve(question);
      });

      // Mock getCustomQuestionsByAppointmentType to return db format
      mockStorage.getCustomQuestionsByAppointmentType.mockResolvedValue(dbQuestions);

      // Save appointment type with questions
      const payload = { questions: frontendQuestions };
      await service.saveAppointmentType(appointmentTypeId, payload);

      // Fetch questions back
      const retrievedQuestions = await service.getAppointmentTypeQuestions(appointmentTypeId);

      // Verify the structure is consistent
      expect(retrievedQuestions).toHaveLength(3);

      // Deep comparison - original camelCase vs retrieved camelCase
      retrievedQuestions.forEach((retrieved, index) => {
        const original = frontendQuestions[index];
        
        // Check that camelCase properties are preserved
        expect(retrieved.isRequired).toBe(original.isRequired);
        expect(retrieved.orderPosition).toBe(original.orderPosition);
        expect(retrieved.appointmentTypeId).toBe(original.appointmentTypeId);
        
        // Check other properties
        expect(retrieved.label).toBe(original.label);
        expect(retrieved.type).toBe(original.type);
        expect(retrieved.placeholder).toBe(original.placeholder);
        expect(retrieved.options).toBe(original.options);
        expect(retrieved.included).toBe(original.included);
      });

      // Verify transformation methods work correctly
      const testObj = {
        isRequired: true,
        orderPosition: 1,
        appointmentTypeId: 123
      };

      const snakeCase = camelToSnake(testObj);
      expect(snakeCase.is_required).toBe(true);
      expect(snakeCase.order_position).toBe(1);
      expect(snakeCase.appointment_type_id).toBe(123);

      const backToCamel = snakeToCamel(snakeCase);
      expect(backToCamel.isRequired).toBe(true);
      expect(backToCamel.orderPosition).toBe(1);
      expect(backToCamel.appointmentTypeId).toBe(123);
    });

    it('should handle different field types correctly', async () => {
      const appointmentTypeId = 1;
      
      // Test different field types
      const frontendQuestions = [
        {
          id: 1,
          label: 'Boolean Field',
          type: 'checkbox',
          isRequired: true,
          orderPosition: 1,
          appointmentTypeId: appointmentTypeId,
          included: true
        },
        {
          id: 2,
          label: 'Optional Field',
          type: 'email',
          isRequired: false,
          orderPosition: 2,
          appointmentTypeId: appointmentTypeId,
          included: false
        }
      ];

      mockStorage.getCustomQuestionsByAppointmentType.mockResolvedValue([]);

      // Mock created questions
      const dbQuestions = frontendQuestions.map(q => ({
        id: q.id,
        label: q.label,
        type: q.type,
        is_required: q.isRequired,
        order_position: q.orderPosition,
        appointment_type_id: q.appointmentTypeId,
        included: q.included,
        created_at: new Date(),
        last_modified_at: new Date()
      }));

      mockStorage.createCustomQuestion.mockImplementation((data: any) => {
        const question = dbQuestions.find(q => q.label === data.label);
        return Promise.resolve(question);
      });

      mockStorage.getCustomQuestionsByAppointmentType.mockResolvedValue(dbQuestions);

      // Save and retrieve
      await service.saveAppointmentType(appointmentTypeId, { questions: frontendQuestions });
      const retrievedQuestions = await service.getAppointmentTypeQuestions(appointmentTypeId);

      // Verify boolean handling
      expect(retrievedQuestions[0].isRequired).toBe(true);
      expect(retrievedQuestions[1].isRequired).toBe(false);
      
      // Verify included field handling
      expect(retrievedQuestions[0].included).toBe(true);
      expect(retrievedQuestions[1].included).toBe(false);
    });

    it('should handle empty questions array', async () => {
      const appointmentTypeId = 1;
      
      mockStorage.getCustomQuestionsByAppointmentType.mockResolvedValue([]);

      // Save with empty questions
      await service.saveAppointmentType(appointmentTypeId, { questions: [] });
      const retrievedQuestions = await service.getAppointmentTypeQuestions(appointmentTypeId);

      expect(retrievedQuestions).toHaveLength(0);
    });

    it('should handle missing questions in payload', async () => {
      const appointmentTypeId = 1;
      
      mockStorage.getCustomQuestionsByAppointmentType.mockResolvedValue([]);

      // Save without questions property
      await service.saveAppointmentType(appointmentTypeId, {});
      const retrievedQuestions = await service.getAppointmentTypeQuestions(appointmentTypeId);

      expect(retrievedQuestions).toHaveLength(0);
    });
  });
}); 