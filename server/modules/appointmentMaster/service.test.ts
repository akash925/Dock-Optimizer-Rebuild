import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { AppointmentMasterService } from './service';
import { getStorage } from '../../storage';
import { CustomQuestion } from '../../../shared/schema';

// Mock the storage module
vi.mock('../../storage', () => ({
  getStorage: vi.fn(),
}));

describe('AppointmentMasterService', () => {
  let service: AppointmentMasterService;
  let mockStorage: any;

  beforeEach(() => {
    mockStorage = {
      getCustomQuestionsByAppointmentType: vi.fn(),
      deleteCustomQuestion: vi.fn(),
      createCustomQuestion: vi.fn(),
      getAppointmentType: vi.fn(),
      updateAppointmentType: vi.fn(),
    };

    (getStorage as Mock).mockResolvedValue(mockStorage);
    service = new AppointmentMasterService();
  });

  describe('saveAppointmentType', () => {
    it('should handle DTO mapping from frontend camelCase to database snake_case', async () => {
      const typeId = 1;
      const payload = {
        questions: [
          {
            label: 'Test Question',
            type: 'TEXT',
            isRequired: true, // Frontend camelCase
            order: 1,
          },
        ],
      };

      const mockCreatedQuestion: CustomQuestion = {
        id: 1,
        label: 'Test Question',
        type: 'TEXT',
        isRequired: true,
        placeholder: null,
        options: null,
        defaultValue: null,
        order: 1,
        appointmentTypeId: 1,
        applicableType: 'both',
        createdAt: new Date(),
        lastModifiedAt: new Date(),
      };

      mockStorage.getCustomQuestionsByAppointmentType.mockResolvedValue([]);
      mockStorage.createCustomQuestion.mockResolvedValue(mockCreatedQuestion);

      const result = await service.saveAppointmentType(typeId, payload);

      expect(mockStorage.createCustomQuestion).toHaveBeenCalledWith({
        label: 'Test Question',
        type: 'TEXT',
        is_required: true, // Should be mapped to snake_case
        appointment_type_id: 1,
        order: 1, // Original field preserved
        order_position: 1, // Transformed field
      });

      expect(result.questions).toEqual([
        expect.objectContaining({
          isRequired: true, // Should be mapped back to camelCase for frontend
        }),
      ]);
    });

    it('should handle empty questions array without errors', async () => {
      const typeId = 1;
      const payload = { questions: [] };

      mockStorage.getCustomQuestionsByAppointmentType.mockResolvedValue([]);

      const result = await service.saveAppointmentType(typeId, payload);

      expect(result.questions).toEqual([]);
      expect(mockStorage.createCustomQuestion).not.toHaveBeenCalled();
    });

    it('should handle null questions array by defaulting to empty array', async () => {
      const typeId = 1;
      const payload = { questions: null };

      mockStorage.getCustomQuestionsByAppointmentType.mockResolvedValue([]);

      const result = await service.saveAppointmentType(typeId, payload);

      expect(result.questions).toEqual([]);
      expect(mockStorage.createCustomQuestion).not.toHaveBeenCalled();
    });

    it('should handle undefined questions array by defaulting to empty array', async () => {
      const typeId = 1;
      const payload = {};

      mockStorage.getCustomQuestionsByAppointmentType.mockResolvedValue([]);

      const result = await service.saveAppointmentType(typeId, payload);

      expect(result.questions).toEqual([]);
      expect(mockStorage.createCustomQuestion).not.toHaveBeenCalled();
    });

    it('should handle the standard 12-question seed set properly', async () => {
      const typeId = 1;
      const standardQuestions = [
        { id: 1, label: "Customer Name", type: "TEXT", isRequired: true, included: true, order: 1, appointmentType: "both" },
        { id: 2, label: "Carrier Name", type: "TEXT", isRequired: true, included: true, order: 2, appointmentType: "both" },
        { id: 3, label: "Carrier MC #", type: "TEXT", isRequired: true, included: true, order: 3, appointmentType: "both" },
        { id: 4, label: "Driver/Dispatcher Email", type: "EMAIL", isRequired: true, included: true, order: 4, appointmentType: "both" },
        { id: 5, label: "Driver/Dispatcher Phone Number", type: "TEXT", isRequired: false, included: true, order: 5, appointmentType: "both" },
        { id: 6, label: "Driver's License Number", type: "TEXT", isRequired: false, included: true, order: 6, appointmentType: "both" },
        { id: 7, label: "BOL Doc", type: "FILE", isRequired: false, included: true, order: 7, appointmentType: "both" },
        { id: 8, label: "BOL Number", type: "TEXT", isRequired: true, included: true, order: 8, appointmentType: "both" },
        { id: 9, label: "Truck Number", type: "TEXT", isRequired: true, included: true, order: 9, appointmentType: "both" },
        { id: 10, label: "Trailer Number", type: "TEXT", isRequired: false, included: true, order: 10, appointmentType: "both" },
        { id: 11, label: "Driver's Name", type: "TEXT", isRequired: false, included: true, order: 11, appointmentType: "both" },
        { id: 12, label: "Item Description/Quantity", type: "TEXTAREA", isRequired: false, included: true, order: 12, appointmentType: "both" }
      ];

      const payload = { questions: standardQuestions };

      mockStorage.getCustomQuestionsByAppointmentType.mockResolvedValue([]);
      
      // Mock createCustomQuestion to return a question for each call
      standardQuestions.forEach((question, index) => {
        const mockQuestion: CustomQuestion = {
          id: index + 1,
          label: question.label,
          type: question.type as any,
          isRequired: question.isRequired,
          placeholder: null,
          options: null,
          defaultValue: null,
          order: question.order,
          appointmentTypeId: 1,
          applicableType: 'both',
          createdAt: new Date(),
          lastModifiedAt: new Date(),
        };
        mockStorage.createCustomQuestion.mockResolvedValueOnce(mockQuestion);
      });

      const result = await service.saveAppointmentType(typeId, payload);

      // Verify all 12 questions were processed
      expect(mockStorage.createCustomQuestion).toHaveBeenCalledTimes(12);
      expect(result.questions).toHaveLength(12);

      // Verify BOL document workflow is properly included
      const bolDocQuestion = result.questions.find(q => q.label === "BOL Doc");
      expect(bolDocQuestion).toBeDefined();
      expect(bolDocQuestion).toMatchObject({
        label: "BOL Doc",
        type: "FILE",
        isRequired: false, // Should be optional by default but can be made required
      });

      // Verify proper field mapping for all questions
      standardQuestions.forEach((originalQuestion, index) => {
        expect(mockStorage.createCustomQuestion).toHaveBeenNthCalledWith(index + 1, expect.objectContaining({
          label: originalQuestion.label,
          type: originalQuestion.type,
          is_required: originalQuestion.isRequired, // Mapped to snake_case
          appointment_type_id: 1,
          order_position: originalQuestion.order,
        }));
      });
    });

    it('should replace existing questions when updating', async () => {
      const typeId = 1;
      const existingQuestions = [
        { id: 1, label: 'Old Question', type: 'TEXT', isRequired: false, order: 1, appointmentTypeId: 1 }
      ];
      const newQuestions = [
        { label: 'New Question', type: 'TEXT', isRequired: true, order: 1 }
      ];

      mockStorage.getCustomQuestionsByAppointmentType.mockResolvedValue(existingQuestions);
      mockStorage.createCustomQuestion.mockResolvedValue({
        id: 2,
        label: 'New Question',
        type: 'TEXT',
        isRequired: true,
        order: 1,
        appointmentTypeId: 1,
        applicableType: 'both',
        createdAt: new Date(),
        lastModifiedAt: new Date(),
      });

      await service.saveAppointmentType(typeId, { questions: newQuestions });

      // Should delete existing questions
      expect(mockStorage.deleteCustomQuestion).toHaveBeenCalledWith(1);
      
      // Should create new questions
      expect(mockStorage.createCustomQuestion).toHaveBeenCalledWith({
        label: 'New Question',
        type: 'TEXT',
        is_required: true,
        appointment_type_id: 1,
        order: 1, // Original field preserved
        order_position: 1, // Transformed field
      });
    });

    it('should handle boolean conversion for isRequired field', async () => {
      const typeId = 1;
      const payload = {
        questions: [
          { label: 'Test 1', type: 'TEXT', isRequired: 'true', order: 1 }, // String 'true'
          { label: 'Test 2', type: 'TEXT', isRequired: 1, order: 2 }, // Number 1
          { label: 'Test 3', type: 'TEXT', isRequired: false, order: 3 }, // Boolean false
          { label: 'Test 4', type: 'TEXT', isRequired: null, order: 4 }, // null
          { label: 'Test 5', type: 'TEXT', order: 5 }, // undefined
        ],
      };

      mockStorage.getCustomQuestionsByAppointmentType.mockResolvedValue([]);
      
      payload.questions.forEach((question, index) => {
        mockStorage.createCustomQuestion.mockResolvedValueOnce({
          id: index + 1,
          label: question.label,
          type: question.type,
          isRequired: Boolean(question.isRequired),
          order: question.order,
          appointmentTypeId: 1,
          applicableType: 'both',
          createdAt: new Date(),
          lastModifiedAt: new Date(),
        });
      });

      await service.saveAppointmentType(typeId, payload);

      // Verify boolean conversion
      expect(mockStorage.createCustomQuestion).toHaveBeenNthCalledWith(1, expect.objectContaining({ is_required: true }));
      expect(mockStorage.createCustomQuestion).toHaveBeenNthCalledWith(2, expect.objectContaining({ is_required: true }));
      expect(mockStorage.createCustomQuestion).toHaveBeenNthCalledWith(3, expect.objectContaining({ is_required: false }));
      expect(mockStorage.createCustomQuestion).toHaveBeenNthCalledWith(4, expect.objectContaining({ is_required: false }));
      expect(mockStorage.createCustomQuestion).toHaveBeenNthCalledWith(5, expect.objectContaining({ is_required: false }));
    });

    it('should provide default values for missing question fields', async () => {
      const typeId = 1;
      const payload = {
        questions: [
          { order: 1 }, // Missing label, type, isRequired
        ],
      };

      mockStorage.getCustomQuestionsByAppointmentType.mockResolvedValue([]);
      mockStorage.createCustomQuestion.mockResolvedValue({
        id: 1,
        label: 'Untitled Question',
        type: 'TEXT',
        isRequired: false,
        order: 1,
        appointmentTypeId: 1,
        applicableType: 'both',
        createdAt: new Date(),
        lastModifiedAt: new Date(),
      });

      await service.saveAppointmentType(typeId, payload);

      expect(mockStorage.createCustomQuestion).toHaveBeenCalledWith({
        label: 'Untitled Question', // Default label
        type: 'TEXT', // Default type
        is_required: false, // Default isRequired
        appointment_type_id: 1,
        order: 1, // Original field preserved
        order_position: 1, // Transformed field
      });
    });
  });

  describe('getAppointmentType', () => {
    it('should delegate to storage.getAppointmentType', async () => {
      const typeId = 1;
      const mockAppointmentType = { id: 1, name: 'Test Type' };
      
      mockStorage.getAppointmentType.mockResolvedValue(mockAppointmentType);

      const result = await service.getAppointmentType(typeId);

      expect(mockStorage.getAppointmentType).toHaveBeenCalledWith(typeId);
      expect(result).toStrictEqual(mockAppointmentType);
    });
  });

  describe('updateAppointmentType', () => {
    it('should delegate to storage.updateAppointmentType', async () => {
      const typeId = 1;
      const updateData = { name: 'Updated Type' };
      const mockUpdatedType = { id: 1, name: 'Updated Type' };
      
      mockStorage.updateAppointmentType.mockResolvedValue(mockUpdatedType);

      const result = await service.updateAppointmentType(typeId, updateData);

      expect(mockStorage.updateAppointmentType).toHaveBeenCalledWith(typeId, updateData);
      expect(result).toStrictEqual(mockUpdatedType);
    });

    it('should properly handle inbound/outbound/both appointment type selections', async () => {
      const typeId = 1;
      
      // Test inbound only
      const inboundData = { name: 'Inbound Only Type', type: 'inbound' };
      const mockInboundType = { id: 1, name: 'Inbound Only Type', type: 'inbound' };
      mockStorage.updateAppointmentType.mockResolvedValueOnce(mockInboundType);
      
      let result = await service.updateAppointmentType(typeId, inboundData);
      expect(mockStorage.updateAppointmentType).toHaveBeenCalledWith(typeId, inboundData);
      expect(result.type).toBe('inbound');

      // Test outbound only
      const outboundData = { name: 'Outbound Only Type', type: 'outbound' };
      const mockOutboundType = { id: 1, name: 'Outbound Only Type', type: 'outbound' };
      mockStorage.updateAppointmentType.mockResolvedValueOnce(mockOutboundType);
      
      result = await service.updateAppointmentType(typeId, outboundData);
      expect(mockStorage.updateAppointmentType).toHaveBeenCalledWith(typeId, outboundData);
      expect(result.type).toBe('outbound');

      // Test both inbound and outbound
      const bothData = { name: 'Both Type', type: 'both' };
      const mockBothType = { id: 1, name: 'Both Type', type: 'both' };
      mockStorage.updateAppointmentType.mockResolvedValueOnce(mockBothType);
      
      result = await service.updateAppointmentType(typeId, bothData);
      expect(mockStorage.updateAppointmentType).toHaveBeenCalledWith(typeId, bothData);
      expect(result.type).toBe('both');
    });
  });
}); 