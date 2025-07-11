import { vi } from 'vitest';

export class MockStorage {
  private fileRecords: any[] = [];
  private bolDocuments: any[] = [];
  private schedules: any[] = [];
  private users: any[] = [];
  private tenants: any[] = [];
  private companyAssets: any[] = [];
  private organizations: any[] = [];
  private facilities: any[] = [];
  private appointmentTypes: any[] = [];
  private customQuestions: any[] = [];
  private organizationDefaultHours: any[] = [];
  private organizationHolidays: any[] = [];
  private ocrJobs: any[] = [];

  // FileRecord methods
  async createFileRecord(data: any) {
    const fileRecord = { id: Math.floor(Math.random() * 1000), ...data };
    this.fileRecords.push(fileRecord);
    return fileRecord;
  }

  async getFileRecord(id: number) {
    return this.fileRecords.find(record => record.id === id);
  }

  async updateFileRecord(id: number, data: any) {
    const index = this.fileRecords.findIndex(record => record.id === id);
    if (index !== -1) {
      this.fileRecords[index] = { ...this.fileRecords[index], ...data };
      return this.fileRecords[index];
    }
    return null;
  }

  async deleteFileRecord(id: number) {
    const index = this.fileRecords.findIndex(record => record.id === id);
    if (index !== -1) {
      return this.fileRecords.splice(index, 1)[0];
    }
    return null;
  }

  // BOL Document methods
  async createBolDocument(data: any) {
    const bolDoc = { id: Math.floor(Math.random() * 1000), ...data };
    this.bolDocuments.push(bolDoc);
    return bolDoc;
  }

  async getBolDocument(id: number) {
    return this.bolDocuments.find(doc => doc.id === id);
  }

  async getBolDocumentsByScheduleId(scheduleId: number) {
    return this.bolDocuments.filter(doc => doc.scheduleId === scheduleId);
  }

  async deleteBolDocument(id: number) {
    const index = this.bolDocuments.findIndex(doc => doc.id === id);
    if (index !== -1) {
      return this.bolDocuments.splice(index, 1)[0];
    }
    return null;
  }

  // Schedule methods
  async createSchedule(data: any) {
    const schedule = { id: Math.floor(Math.random() * 1000), ...data };
    this.schedules.push(schedule);
    return schedule;
  }

  async getSchedule(id: number) {
    return this.schedules.find(schedule => schedule.id === id);
  }

  async getSchedules(tenantId?: number) {
    if (tenantId) {
      return this.schedules.filter(schedule => schedule.tenantId === tenantId);
    }
    return this.schedules;
  }

  async getSchedulesByTenantId(tenantId: number) {
    return this.schedules.filter(schedule => schedule.tenantId === tenantId);
  }

  async updateSchedule(id: number, data: any) {
    const index = this.schedules.findIndex(schedule => schedule.id === id);
    if (index !== -1) {
      this.schedules[index] = { ...this.schedules[index], ...data };
      return this.schedules[index];
    }
    return null;
  }

  // User methods
  async createUser(data: any) {
    const user = { id: Math.floor(Math.random() * 1000), ...data };
    this.users.push(user);
    return user;
  }

  async getUser(id: number) {
    return this.users.find(user => user.id === id);
  }

  async getUsersByTenantId(tenantId: number) {
    return this.users.filter(user => user.tenantId === tenantId);
  }

  // Tenant/Organization methods
  async createTenant(data: any) {
    const tenant = { id: Math.floor(Math.random() * 1000), ...data };
    this.tenants.push(tenant);
    this.organizations.push(tenant); // For compatibility with organization lookups
    return tenant;
  }

  async getOrganizationByFacilityId(facilityId: number) {
    // Look up facility first, then get organization
    const facility = this.facilities.find(f => f.id === facilityId);
    if (!facility) return null;
    
    // Return a mock organization based on the facility
    return this.organizations.find(org => org.id === facility.organizationId) || {
      id: facility.organizationId || 1,
      name: 'Test Organization',
      subdomain: 'test-org',
      enforceWeekendRule: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  // Organization methods
  async createOrganization(data: any) {
    const org = { id: Math.floor(Math.random() * 1000), ...data };
    this.organizations.push(org);
    return org;
  }

  async getOrganization(id: number) {
    return this.organizations.find(org => org.id === id);
  }

  setOrganization(id: number, data: any) {
    const index = this.organizations.findIndex(org => org.id === id);
    if (index !== -1) {
      this.organizations[index] = { ...this.organizations[index], ...data };
    } else {
      this.organizations.push({ id, ...data });
    }
  }

  async updateOrganization(id: number, data: any) {
    const index = this.organizations.findIndex(org => org.id === id);
    if (index !== -1) {
      this.organizations[index] = { ...this.organizations[index], ...data };
      return this.organizations[index];
    }
    return null;
  }

  // Facility methods
  async createFacility(data: any) {
    const facility = { id: Math.floor(Math.random() * 1000), ...data };
    this.facilities.push(facility);
    return facility;
  }

  async getFacility(id: number) {
    return this.facilities.find(facility => facility.id === id);
  }

  setFacility(id: number, data: any) {
    const index = this.facilities.findIndex(facility => facility.id === id);
    if (index !== -1) {
      this.facilities[index] = { ...this.facilities[index], ...data };
    } else {
      this.facilities.push({ id, ...data });
    }
  }

  async updateFacility(id: number, data: any) {
    const index = this.facilities.findIndex(facility => facility.id === id);
    if (index !== -1) {
      this.facilities[index] = { ...this.facilities[index], ...data };
      return this.facilities[index];
    }
    return null;
  }

  // Appointment Type methods
  setAppointmentType(id: number, data: any) {
    const index = this.appointmentTypes.findIndex(type => type.id === id);
    if (index !== -1) {
      this.appointmentTypes[index] = { ...this.appointmentTypes[index], ...data };
    } else {
      this.appointmentTypes.push({ id, ...data });
    }
  }

  async createAppointmentType(data: any) {
    const appointmentType = { id: Math.floor(Math.random() * 1000), ...data };
    this.appointmentTypes.push(appointmentType);
    return appointmentType;
  }

  async getAppointmentType(id: number) {
    return this.appointmentTypes.find(type => type.id === id);
  }

  async updateAppointmentType(id: number, data: any) {
    const index = this.appointmentTypes.findIndex(type => type.id === id);
    if (index !== -1) {
      this.appointmentTypes[index] = { ...this.appointmentTypes[index], ...data };
      return this.appointmentTypes[index];
    }
    return null;
  }

  // Custom Question methods
  async createCustomQuestion(data: any) {
    const question = { id: Math.floor(Math.random() * 1000), ...data };
    this.customQuestions.push(question);
    return question;
  }

  async getCustomQuestionsByAppointmentTypeId(appointmentTypeId: number) {
    return this.customQuestions.filter(q => q.appointmentTypeId === appointmentTypeId);
  }

  async deleteCustomQuestionsByAppointmentTypeId(appointmentTypeId: number) {
    this.customQuestions = this.customQuestions.filter(q => q.appointmentTypeId !== appointmentTypeId);
  }

  // Organization Default Hours methods
  setOrganizationDefaultHours(organizationId: number, hours: any[]) {
    // Remove existing hours for this organization
    this.organizationDefaultHours = this.organizationDefaultHours.filter(h => h.organizationId !== organizationId);
    // Add new hours
    hours.forEach(hour => {
      this.organizationDefaultHours.push({ 
        id: Math.floor(Math.random() * 1000), 
        organizationId, 
        ...hour 
      });
    });
  }

  async getOrganizationDefaultHours(organizationId: number) {
    return this.organizationDefaultHours.filter(h => h.organizationId === organizationId);
  }

  // Organization Holidays methods
  setOrganizationHolidays(organizationId: number, holidays: any[]) {
    // Remove existing holidays for this organization
    this.organizationHolidays = this.organizationHolidays.filter(h => h.organizationId !== organizationId);
    // Add new holidays
    holidays.forEach(holiday => {
      this.organizationHolidays.push({ 
        id: Math.floor(Math.random() * 1000), 
        organizationId, 
        ...holiday 
      });
    });
  }

  async getOrganizationHolidays(organizationId: number) {
    return this.organizationHolidays.filter(h => h.organizationId === organizationId);
  }

  async createOrganizationHoliday(data: any) {
    const holiday = { id: Math.floor(Math.random() * 1000), ...data };
    this.organizationHolidays.push(holiday);
    return holiday;
  }

  // OCR Jobs methods
  async createOcrJob(data: any) {
    const job = { id: Math.floor(Math.random() * 1000), ...data };
    this.ocrJobs.push(job);
    return job;
  }

  async getOcrJob(id: number) {
    return this.ocrJobs.find(job => job.id === id);
  }

  // Company Assets methods
  async createCompanyAsset(data: any) {
    const asset = { id: Math.floor(Math.random() * 1000), ...data };
    this.companyAssets.push(asset);
    return asset;
  }

  async getCompanyAsset(id: number) {
    return this.companyAssets.find(asset => asset.id === id);
  }

  async getCompanyAssetsByTenantId(tenantId: number) {
    return this.companyAssets.filter(asset => asset.tenantId === tenantId);
  }

  async updateCompanyAssetStatus(id: number, status: string) {
    return this.updateCompanyAsset(id, { status });
  }

  async updateCompanyAsset(id: number, data: any) {
    const index = this.companyAssets.findIndex(asset => asset.id === id);
    if (index !== -1) {
      this.companyAssets[index] = { ...this.companyAssets[index], ...data };
      return this.companyAssets[index];
    }
    return null;
  }

  async getCompanyAssetByBarcode(barcode: string) {
    return this.companyAssets.find(asset => asset.barcode === barcode);
  }

  async importCompanyAssets(assets: any[]) {
    const imported = assets.map(asset => ({
      id: Math.floor(Math.random() * 1000),
      ...asset
    }));
    this.companyAssets.push(...imported);
    return { 
      total: imported.length, 
      successful: imported.length,
      failed: 0,
      assets: imported
    };
  }

  // Utility methods
  reset() {
    this.fileRecords = [];
    this.bolDocuments = [];
    this.schedules = [];
    this.users = [];
    this.tenants = [];
    this.companyAssets = [];
    this.organizations = [];
    this.facilities = [];
    this.appointmentTypes = [];
    this.customQuestions = [];
    this.organizationDefaultHours = [];
    this.organizationHolidays = [];
    this.ocrJobs = [];
  }

  seed(data: any = {}) {
    if (data.tenants) this.tenants = [...data.tenants];
    if (data.users) this.users = [...data.users];
    if (data.schedules) this.schedules = [...data.schedules];
    if (data.fileRecords) this.fileRecords = [...data.fileRecords];
    if (data.bolDocuments) this.bolDocuments = [...data.bolDocuments];
    if (data.companyAssets) this.companyAssets = [...data.companyAssets];
    if (data.organizations) this.organizations = [...data.organizations];
    if (data.facilities) this.facilities = [...data.facilities];
    if (data.appointmentTypes) this.appointmentTypes = [...data.appointmentTypes];
    if (data.customQuestions) this.customQuestions = [...data.customQuestions];
    if (data.organizationDefaultHours) this.organizationDefaultHours = [...data.organizationDefaultHours];
    if (data.organizationHolidays) this.organizationHolidays = [...data.organizationHolidays];
    if (data.ocrJobs) this.ocrJobs = [...data.ocrJobs];
  }
}

// Create default mock instance
export const mockStorage = new MockStorage();

// Mock the getStorage function
export const getStorage = vi.fn().mockResolvedValue(mockStorage);

// Export default instance for easy importing
export default mockStorage; 