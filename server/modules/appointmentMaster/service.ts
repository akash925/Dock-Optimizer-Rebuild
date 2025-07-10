import { getStorage } from '../../storage';

export class AppointmentMasterService {
  private storage: any;

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

      const uiQs = payload.questions ?? [];
      const dbQs = uiQs.map((q: any) => ({ ...q, is_required: q.isRequired }));
      
      // Replace questions for this appointment type
      await this.replaceQuestionsForType(typeId, dbQs);
      
      // Return snake_case for FE re-map
      return { questions: dbQs };
    } catch (error) {
      console.error('Error saving appointment type:', error);
      throw error;
    }
  }

  private async replaceQuestionsForType(typeId: number, questions: any[]) {
    try {
      // Get existing questions for this appointment type
      const existingQuestions = await this.storage.getCustomQuestionsByAppointmentType(typeId);
      
      // Delete existing questions
      for (const existingQuestion of existingQuestions) {
        await this.storage.deleteCustomQuestion(existingQuestion.id);
      }
      
      // Create new questions
      const createdQuestions = [];
      for (const question of questions) {
        const newQuestion = await this.storage.createCustomQuestion({
          ...question,
          appointmentTypeId: typeId,
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