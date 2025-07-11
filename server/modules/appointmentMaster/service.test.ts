import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppointmentMasterService } from './service';
import { getStorage } from '../../storage';
import { CustomQuestion } from '../../../shared/schema';

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

    vi.mocked(getStorage).mockResolvedValue(mockStorage);
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
          appointmentTypeId: 1,
          order: 1,
        });

              expect(result.questions[0]).toEqual(
          expect.objectContaining({
            label: 'Test Question',
            type: 'TEXT',
            isRequired: true, // Should be mapped back to camelCase for frontend
            appointmentTypeId: 1,
            order: 1,
          })
        );
    });

    it('should handle empty questions array safely', async () => {
      const typeId = 1;
      const payload = {
        questions: null, // Test null case
      };

      mockStorage.getCustomQuestionsByAppointmentType.mockResolvedValue([]);

      const result = await service.saveAppointmentType(typeId, payload);

      expect(result.questions).toEqual([]);
      expect(mockStorage.createCustomQuestion).not.toHaveBeenCalled();
    });

    it('should handle undefined questions array safely', async () => {
      const typeId = 1;
      const payload = {}; // No questions property

      mockStorage.getCustomQuestionsByAppointmentType.mockResolvedValue([]);

      const result = await service.saveAppointmentType(typeId, payload);

      expect(result.questions).toEqual([]);
      expect(mockStorage.createCustomQuestion).not.toHaveBeenCalled();
    });

    it('should replace existing questions', async () => {
      const typeId = 1;
              const payload = {
          questions: [
            {
              label: 'New Question',
              type: 'TEXT',
              isRequired: false,
              order: 1,
            },
          ],
        };

      const existingQuestion = { id: 99, label: 'Old Question' };
      mockStorage.getCustomQuestionsByAppointmentType.mockResolvedValue([existingQuestion]);
              mockStorage.createCustomQuestion.mockResolvedValue({
          id: 1,
          label: 'New Question',
          type: 'TEXT',
          isRequired: false,
          placeholder: null,
          options: null,
          defaultValue: null,
          order: 1,
          appointmentTypeId: 1,
          applicableType: 'both',
          createdAt: new Date(),
          lastModifiedAt: new Date(),
        });

      await service.saveAppointmentType(typeId, payload);

      expect(mockStorage.deleteCustomQuestion).toHaveBeenCalledWith(99);
              expect(mockStorage.createCustomQuestion).toHaveBeenCalledWith({
          label: 'New Question',
          type: 'TEXT',
          is_required: false,
          appointmentTypeId: 1,
          order: 1,
        });
    });

    it('should provide field defaults when creating questions', async () => {
      const typeId = 1;
      const payload = {
        questions: [
          {
            // Minimal question data
            isRequired: true,
          },
        ],
      };

      mockStorage.getCustomQuestionsByAppointmentType.mockResolvedValue([]);
              mockStorage.createCustomQuestion.mockResolvedValue({
          id: 1,
          label: 'Untitled Question',
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
        });

      await service.saveAppointmentType(typeId, payload);

              expect(mockStorage.createCustomQuestion).toHaveBeenCalledWith({
          label: 'Untitled Question', // Default label
          type: 'TEXT', // Default type
          is_required: true,
          appointmentTypeId: 1,
          order: 1, // Default order
        });
    });

    it('should handle boolean conversion for isRequired field', async () => {
      const typeId = 1;
              const payload = {
          questions: [
            {
              label: 'Test Question',
              type: 'TEXT',
              isRequired: 'true', // String instead of boolean
              order: 1,
            },
          ],
        };

      mockStorage.getCustomQuestionsByAppointmentType.mockResolvedValue([]);
              mockStorage.createCustomQuestion.mockResolvedValue({
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
        });

      await service.saveAppointmentType(typeId, payload);

              expect(mockStorage.createCustomQuestion).toHaveBeenCalledWith({
          label: 'Test Question',
          type: 'TEXT',
          is_required: true, // Should be converted to boolean
          appointmentTypeId: 1,
          order: 1,
        });
    });
  });

  describe('getAppointmentType', () => {
    it('should delegate to storage', async () => {
      const typeId = 1;
      const mockType = { id: 1, name: 'Test Type' };
      mockStorage.getAppointmentType.mockResolvedValue(mockType);

      const result = await service.getAppointmentType(typeId);

      expect(mockStorage.getAppointmentType).toHaveBeenCalledWith(typeId);
      expect(result).toEqual(mockType);
    });
  });

  describe('updateAppointmentType', () => {
    it('should delegate to storage', async () => {
      const typeId = 1;
      const updateData = { name: 'Updated Type' };
      const mockUpdatedType = { id: 1, name: 'Updated Type' };
      mockStorage.updateAppointmentType.mockResolvedValue(mockUpdatedType);

      const result = await service.updateAppointmentType(typeId, updateData);

      expect(mockStorage.updateAppointmentType).toHaveBeenCalledWith(typeId, updateData);
      expect(result).toEqual(mockUpdatedType);
    });
  });
}); 