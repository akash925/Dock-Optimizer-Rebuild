import { getStorage, IStorage } from '../../storage';
import { CustomQuestion } from '../../../shared/schema';

export class AppointmentMasterService {
  private storage: IStorage | null = null;

  constructor() {
    this.init();
  }

  private async init() {
    this.storage = await getStorage();
  }

  async saveAppointmentType(typeId: number, payload: any) {
    try {
      // Ensure storage is initialized
      if (!this.storage) {
        this.storage = await getStorage();
      }

      // Handle questions array safely - default to empty array if undefined/null
      const uiQs = payload.questions ?? [];
      
      // Fix DTO mapping: isRequired (frontend) -> is_required (database)
      const dbQs = uiQs.map((q: any) => {
        const { isRequired, ...rest } = q; // Remove camelCase version
        return {
          ...rest,
          is_required: Boolean(isRequired), // Explicit boolean conversion
          appointmentTypeId: typeId // Ensure appointment type ID is set
        };
      });
      
      // Replace questions for this appointment type
      await this.replaceQuestionsForType(typeId, dbQs);
      
      // Return camelCase for frontend compatibility
      const frontendQs = dbQs.map((q: any) => ({
        ...q,
        isRequired: q.is_required, // Map back to camelCase for frontend
      }));
      
      return { questions: frontendQs };
    } catch (error) {
      console.error('Error saving appointment type:', error);
      throw error;
    }
  }

  private async replaceQuestionsForType(typeId: number, questions: any[]) {
    try {
      // Ensure storage is initialized
      if (!this.storage) {
        this.storage = await getStorage();
      }
      
      // Get existing questions for this appointment type
      const existingQuestions = await this.storage.getCustomQuestionsByAppointmentType(typeId);
      
      // Delete existing questions
      for (const existingQuestion of existingQuestions) {
        await this.storage.deleteCustomQuestion(existingQuestion.id);
      }
      
      // Create new questions (only if questions array is not empty)
      const createdQuestions: CustomQuestion[] = [];
      for (const question of questions) {
        const newQuestion: CustomQuestion = await this.storage.createCustomQuestion({
          ...question,
          appointmentTypeId: typeId,
          // Ensure required fields have defaults
          label: question.label || 'Untitled Question',
          type: question.type || 'TEXT',
          is_required: Boolean(question.is_required),
          order: question.order || createdQuestions.length + 1,
        });
        createdQuestions.push(newQuestion);
      }
      
      return createdQuestions;
    } catch (error) {
      console.error('Error replacing questions for appointment type:', error);
      throw error;
    }
  }

  async getAppointmentType(typeId: number) {
    try {
      if (!this.storage) {
        this.storage = await getStorage();
      }
      
      return await this.storage.getAppointmentType(typeId);
    } catch (error) {
      console.error('Error getting appointment type:', error);
      throw error;
    }
  }

  async updateAppointmentType(typeId: number, updateData: any) {
    try {
      if (!this.storage) {
        this.storage = await getStorage();
      }
      
      return await this.storage.updateAppointmentType(typeId, updateData);
    } catch (error) {
      console.error('Error updating appointment type:', error);
      throw error;
    }
  }
}

export const appointmentMasterService = new AppointmentMasterService(); 