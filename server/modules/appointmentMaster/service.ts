import { getStorage, IStorage } from '../../storage.js';
import { CustomQuestion } from '../../../shared/schema.js';
import { camelToSnake, snakeToCamel, transformDbToFrontend, transformFrontendToDb } from '../../../shared/utils/object-mapper.js';
import { validateAppointmentTypeQuestionsArray, validateCreateAppointmentTypeQuestion } from './validators.js';

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
      const frontendQuestions = payload.questions ?? [];
      
      // Transform frontend questions (camelCase) to database format (snake_case)
      const dbQuestions = frontendQuestions.map((q: any) => {
        const dbQuestion = transformFrontendToDb(q);
        dbQuestion.appointment_type_id = typeId; // Ensure appointment type ID is set
        return dbQuestion;
      });
      
      // Replace questions for this appointment type
      await this.replaceQuestionsForType(typeId, dbQuestions);
      
      // Transform back to frontend format (camelCase) for response
      const responseQuestions = dbQuestions.map((q: any) => transformDbToFrontend(q));
      
      return { questions: responseQuestions };
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
          appointment_type_id: typeId,
          // Ensure required fields have defaults
          label: question.label || 'Untitled Question',
          type: question.type || 'TEXT',
          is_required: Boolean(question.is_required),
          order_position: question.order_position || createdQuestions.length + 1,
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
      
      const appointmentType = await this.storage.getAppointmentType(typeId);
      
      // Transform to frontend format if needed
      return transformDbToFrontend(appointmentType);
    } catch (error) {
      console.error('Error getting appointment type:', error);
      throw error;
    }
  }

  async getAppointmentTypeQuestions(typeId: number) {
    try {
      if (!this.storage) {
        this.storage = await getStorage();
      }
      
      const questions = await this.storage.getCustomQuestionsByAppointmentType(typeId);
      
      // Transform questions to frontend format (camelCase)
      const frontendQuestions = questions.map(q => transformDbToFrontend(q));
      
      return frontendQuestions;
    } catch (error) {
      console.error('Error getting appointment type questions:', error);
      throw error;
    }
  }

  async updateAppointmentType(typeId: number, updateData: any) {
    try {
      if (!this.storage) {
        this.storage = await getStorage();
      }
      
      // Transform frontend data to database format
      const dbUpdateData = transformFrontendToDb(updateData);
      
      const updatedAppointmentType = await this.storage.updateAppointmentType(typeId, dbUpdateData);
      
      // Transform back to frontend format for response
      return transformDbToFrontend(updatedAppointmentType);
    } catch (error) {
      console.error('Error updating appointment type:', error);
      throw error;
    }
  }
}

export const appointmentMasterService = new AppointmentMasterService(); 