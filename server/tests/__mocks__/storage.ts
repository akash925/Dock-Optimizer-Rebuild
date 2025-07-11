import { vi } from 'vitest';

export interface FileRecord {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  uploadedBy: number;
  uploadedAt: Date;
}

export interface BolDocument {
  id: number;
  fileKey: string;
  uploadedBy: number;
  scheduleId: number;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: Date;
}

export interface Schedule {
  id: number;
  facilityId: number;
  truckNumber: string;
  startTime: Date;
  endTime: Date;
  type: string;
  status: string;
  createdBy: number;
  createdAt: Date;
  tenantId?: number;
  dockId?: number;
}

export interface User {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: number;
  createdAt: Date;
  password?: string;
}

export class MockStorage {
  private fileRecords: Map<string, FileRecord> = new Map();
  private bolDocuments: Map<number, BolDocument> = new Map();
  private schedules: Map<number, Schedule> = new Map();
  private users: Map<number, User> = new Map();
  private nextBolId = 1;
  private nextScheduleId = 1;
  private nextUserId = 1;

  // Additional storage for availability tests
  private organizations: Map<number, any> = new Map();
  private facilities: Map<number, any> = new Map();
  private appointmentTypes: Map<number, any> = new Map();
  private organizationDefaultHours: Map<number, any[]> = new Map();
  private organizationHolidays: Map<number, any[]> = new Map();

  // Additional storage for complete IStorage compatibility
  private docks: Map<number, any> = new Map();
  private carriers: Map<number, any> = new Map();
  private notifications: Map<number, any> = new Map();
  private appointmentSettings: Map<number, any> = new Map();
  private dailyAvailability: Map<number, any> = new Map();
  private customQuestions: Map<number, any> = new Map();
  private standardQuestions: Map<number, any> = new Map();
  private bookingPages: Map<number, any> = new Map();
  private assets: Map<number, any> = new Map();
  private roles: Map<number, any> = new Map();
  private organizationUsers: Map<number, any> = new Map();
  private organizationModules: Map<number, any> = new Map();
  private userPreferences: Map<string, any> = new Map();
  private ocrJobs: Map<number, any> = new Map();
  private activityLogs: Map<number, any> = new Map();

  // Session store for compatibility
  sessionStore: any = {};

  // File management
  async createFileRecord(fileData: Omit<FileRecord, 'id'> & { id?: string }): Promise<FileRecord> {
    const fileRecord: FileRecord = {
      id: fileData.id || `file_${Date.now()}`,
      ...fileData,
    };
    this.fileRecords.set(fileRecord.id, fileRecord);
    return fileRecord;
  }

  async getFileRecord(id: string): Promise<FileRecord | null> {
    return this.fileRecords.get(id) || null;
  }

  async deleteFileRecord(id: string): Promise<boolean> {
    return this.fileRecords.delete(id);
  }

  async getTempFiles(cutoffDate: Date): Promise<any[]> {
    return Array.from(this.fileRecords.values()).filter(
      file => file.uploadedAt < cutoffDate
    );
  }

  // BOL document management
  async createBolDocument(bolData: Omit<BolDocument, 'id' | 'createdAt'>): Promise<BolDocument> {
    const bolDocument: BolDocument = {
      id: this.nextBolId++,
      ...bolData,
      createdAt: new Date(),
    };
    this.bolDocuments.set(bolDocument.id, bolDocument);
    return bolDocument;
  }

  async getBolDocumentById(id: number): Promise<BolDocument | null> {
    return this.bolDocuments.get(id) || null;
  }

  async getBolDocumentsByScheduleId(scheduleId: number): Promise<BolDocument[]> {
    return Array.from(this.bolDocuments.values()).filter(doc => doc.scheduleId === scheduleId);
  }

  async deleteBolDocument(id: number): Promise<boolean> {
    return this.bolDocuments.delete(id);
  }

  // Schedule management
  async createSchedule(scheduleData: any): Promise<Schedule> {
    // Determine tenantId from dockId if not provided
    let tenantId = scheduleData.tenantId;
    if (!tenantId && scheduleData.dockId) {
      const dock = this.docks.get(scheduleData.dockId);
      if (dock) {
        const facility = this.facilities.get(dock.facilityId);
        if (facility) {
          tenantId = facility.tenantId;
        }
      }
    }

    const schedule: Schedule = {
      id: this.nextScheduleId++,
      ...scheduleData,
      tenantId,
      createdAt: new Date(),
    };
    this.schedules.set(schedule.id, schedule);
    return schedule;
  }

  async getSchedule(id: number): Promise<Schedule | null> {
    return this.schedules.get(id) || null;
  }

  async getSchedules(tenantId?: number): Promise<Schedule[]> {
    let schedules = Array.from(this.schedules.values());
    if (tenantId) {
      schedules = schedules.filter((s: any) => s.tenantId === tenantId);
    }
    return schedules;
  }

  async getSchedulesByFacility(facilityId: number): Promise<Schedule[]> {
    return Array.from(this.schedules.values()).filter(schedule => schedule.facilityId === facilityId);
  }

  async getSchedulesByDateRange(startDate: Date, endDate: Date): Promise<Schedule[]> {
    return Array.from(this.schedules.values()).filter(schedule => 
      schedule.startTime >= startDate && schedule.endTime <= endDate
    );
  }

  async searchSchedules(query: string): Promise<Schedule[]> {
    return Array.from(this.schedules.values()).filter(schedule => 
      schedule.truckNumber.includes(query) || schedule.status.includes(query)
    );
  }

  async getScheduleByConfirmationCode(code: string): Promise<Schedule | null> {
    return Array.from(this.schedules.values()).find((s: any) => s.confirmationCode === code) || null;
  }

  async getSchedulesByDock(dockId: number): Promise<Schedule[]> {
    return Array.from(this.schedules.values()).filter((s: any) => s.dockId === dockId);
  }

  async updateSchedule(id: number, updates: Partial<Schedule>): Promise<Schedule | null> {
    const schedule = this.schedules.get(id);
    if (!schedule) return null;

    const updatedSchedule = { ...schedule, ...updates };
    this.schedules.set(id, updatedSchedule);
    return updatedSchedule;
  }

  async deleteSchedule(id: number): Promise<boolean> {
    return this.schedules.delete(id);
  }

  // User management
  async createUser(userData: any): Promise<User> {
    const user: User = {
      id: this.nextUserId++,
      ...userData,
      createdAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }

  async getUser(id: number): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return Array.from(this.users.values()).find(user => user.email === email) || null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    return Array.from(this.users.values()).find(user => user.username === username) || null;
  }

  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | null> {
    const user = this.users.get(id);
    if (!user) return null;

    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async updateUserPassword(id: number, currentPassword: string, newPassword: string): Promise<boolean> {
    const user = this.users.get(id);
    return !!user; // Mock implementation
  }

  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }

  // Dock management
  async getDock(id: number): Promise<any | null> {
    return this.docks.get(id) || null;
  }

  async getDocks(): Promise<any[]> {
    return Array.from(this.docks.values());
  }

  async getDocksByFacility(facilityId: number): Promise<any[]> {
    return Array.from(this.docks.values()).filter(dock => dock.facilityId === facilityId);
  }

  async createDock(dockData: any): Promise<any> {
    const dock = {
      id: Math.floor(Math.random() * 1000),
      ...dockData,
      createdAt: new Date(),
    };
    this.docks.set(dock.id, dock);
    return dock;
  }

  async updateDock(id: number, updates: any): Promise<any | null> {
    const dock = this.docks.get(id);
    if (!dock) return null;
    const updatedDock = { ...dock, ...updates };
    this.docks.set(id, updatedDock);
    return updatedDock;
  }

  async deleteDock(id: number): Promise<boolean> {
    return this.docks.delete(id);
  }

  // Carrier management
  async getCarrier(id: number): Promise<any | null> {
    return this.carriers.get(id) || null;
  }

  async getCarriers(): Promise<any[]> {
    return Array.from(this.carriers.values());
  }

  async createCarrier(carrierData: any): Promise<any> {
    const carrier = {
      id: Math.floor(Math.random() * 1000),
      ...carrierData,
    };
    this.carriers.set(carrier.id, carrier);
    return carrier;
  }

  async updateCarrier(id: number, updates: any): Promise<any | null> {
    const carrier = this.carriers.get(id);
    if (!carrier) return null;
    const updatedCarrier = { ...carrier, ...updates };
    this.carriers.set(id, updatedCarrier);
    return updatedCarrier;
  }

  // Notification management
  async getNotification(id: number): Promise<any | null> {
    return this.notifications.get(id) || null;
  }

  async getNotificationsByUser(userId: number): Promise<any[]> {
    return Array.from(this.notifications.values()).filter(notification => notification.userId === userId);
  }

  async createNotification(notificationData: any): Promise<any> {
    const notification = {
      id: Math.floor(Math.random() * 1000),
      ...notificationData,
      createdAt: new Date(),
    };
    this.notifications.set(notification.id, notification);
    return notification;
  }

  async markNotificationAsRead(id: number): Promise<any | null> {
    const notification = this.notifications.get(id);
    if (!notification) return null;
    notification.isRead = true;
    return notification;
  }

  // Organization management - for availability tests
  setOrganization(id: number, organizationData: any): void {
    this.organizations.set(id, organizationData);
  }

  async getOrganization(tenantId: number): Promise<any | null> {
    return this.organizations.get(tenantId) || null;
  }

  async getOrganizationByFacilityId(facilityId: number): Promise<any | null> {
    const facility = this.facilities.get(facilityId);
    if (!facility) return null;
    return this.organizations.get(facility.tenantId) || null;
  }

  async getOrganizationByAppointmentTypeId(appointmentTypeId: number): Promise<any | null> {
    const appointmentType = this.appointmentTypes.get(appointmentTypeId);
    if (!appointmentType) return null;
    return this.organizations.get(appointmentType.tenantId) || null;
  }

  async updateOrganization(tenantId: number, data: any): Promise<any | null> {
    const org = this.organizations.get(tenantId);
    if (!org) return null;
    const updatedOrg = { ...org, ...data };
    this.organizations.set(tenantId, updatedOrg);
    return updatedOrg;
  }

  // Facility management - for availability tests
  setFacility(id: number, facilityData: any): void {
    this.facilities.set(id, facilityData);
  }

  async getFacility(id: number, tenantId?: number): Promise<any | null> {
    const facility = this.facilities.get(id);
    if (!facility) return null;
    if (tenantId && facility.tenantId !== tenantId) return null;
    return facility;
  }

  async getFacilities(tenantId?: number): Promise<any[]> {
    let facilities = Array.from(this.facilities.values());
    if (tenantId) {
      facilities = facilities.filter(facility => facility.tenantId === tenantId);
    }
    return facilities;
  }

  async getFacilitiesByOrganizationId(organizationId: number): Promise<any[]> {
    return Array.from(this.facilities.values()).filter(facility => facility.tenantId === organizationId);
  }

  async getFacilityTenantId(facilityId: number): Promise<number> {
    const facility = this.facilities.get(facilityId);
    return facility?.tenantId || 1;
  }

  async getFacilityById(id: number, tenantId?: number): Promise<any | null> {
    return this.getFacility(id, tenantId);
  }

  async createFacility(facilityData: any): Promise<any> {
    const facility = {
      id: Math.floor(Math.random() * 1000),
      ...facilityData,
    };
    this.facilities.set(facility.id, facility);
    return facility;
  }

  async updateFacility(id: number, updates: any): Promise<any | null> {
    const facility = this.facilities.get(id);
    if (!facility) return null;
    const updatedFacility = { ...facility, ...updates };
    this.facilities.set(id, updatedFacility);
    return updatedFacility;
  }

  async deleteFacility(id: number): Promise<boolean> {
    return this.facilities.delete(id);
  }

  // Appointment type management - for availability tests
  setAppointmentType(id: number, appointmentTypeData: any): void {
    this.appointmentTypes.set(id, appointmentTypeData);
  }

  async getAppointmentType(id: number): Promise<any | null> {
    return this.appointmentTypes.get(id) || null;
  }

  async getAppointmentTypes(): Promise<any[]> {
    return Array.from(this.appointmentTypes.values());
  }

  async getAppointmentTypesByFacility(facilityId: number): Promise<any[]> {
    return Array.from(this.appointmentTypes.values()).filter(type => type.facilityId === facilityId);
  }

  async createAppointmentType(appointmentTypeData: any): Promise<any> {
    const appointmentType = {
      id: Math.floor(Math.random() * 1000),
      ...appointmentTypeData,
    };
    this.appointmentTypes.set(appointmentType.id, appointmentType);
    return appointmentType;
  }

  async updateAppointmentType(id: number, updates: any): Promise<any | null> {
    const appointmentType = this.appointmentTypes.get(id);
    if (!appointmentType) return null;
    const updatedAppointmentType = { ...appointmentType, ...updates };
    this.appointmentTypes.set(id, updatedAppointmentType);
    return updatedAppointmentType;
  }

  async deleteAppointmentType(id: number): Promise<boolean> {
    return this.appointmentTypes.delete(id);
  }

  // Appointment Settings
  async getAppointmentSettings(facilityId: number): Promise<any | null> {
    return Array.from(this.appointmentSettings.values()).find(settings => settings.facilityId === facilityId) || null;
  }

  async createAppointmentSettings(settingsData: any): Promise<any> {
    const settings = {
      id: Math.floor(Math.random() * 1000),
      ...settingsData,
    };
    this.appointmentSettings.set(settings.id, settings);
    return settings;
  }

  async updateAppointmentSettings(facilityId: number, updates: any): Promise<any | null> {
    const settings = Array.from(this.appointmentSettings.values()).find(s => s.facilityId === facilityId);
    if (!settings) return null;
    const updatedSettings = { ...settings, ...updates };
    this.appointmentSettings.set(settings.id, updatedSettings);
    return updatedSettings;
  }

  // Daily Availability
  async getDailyAvailability(id: number): Promise<any | null> {
    return this.dailyAvailability.get(id) || null;
  }

  async getDailyAvailabilityByAppointmentType(appointmentTypeId: number): Promise<any[]> {
    return Array.from(this.dailyAvailability.values()).filter(da => da.appointmentTypeId === appointmentTypeId);
  }

  async createDailyAvailability(availabilityData: any): Promise<any> {
    const availability = {
      id: Math.floor(Math.random() * 1000),
      ...availabilityData,
    };
    this.dailyAvailability.set(availability.id, availability);
    return availability;
  }

  async updateDailyAvailability(id: number, updates: any): Promise<any | null> {
    const availability = this.dailyAvailability.get(id);
    if (!availability) return null;
    const updatedAvailability = { ...availability, ...updates };
    this.dailyAvailability.set(id, updatedAvailability);
    return updatedAvailability;
  }

  async deleteDailyAvailability(id: number): Promise<boolean> {
    return this.dailyAvailability.delete(id);
  }

  // Custom Questions
  async getCustomQuestion(id: number): Promise<any | null> {
    return this.customQuestions.get(id) || null;
  }

  async getCustomQuestionsByAppointmentType(appointmentTypeId: number): Promise<any[]> {
    return Array.from(this.customQuestions.values()).filter(q => q.appointmentTypeId === appointmentTypeId);
  }

  async createCustomQuestion(questionData: any): Promise<any> {
    const question = {
      id: Math.floor(Math.random() * 1000),
      ...questionData,
      createdAt: new Date(),
    };
    this.customQuestions.set(question.id, question);
    return question;
  }

  async updateCustomQuestion(id: number, updates: any): Promise<any | null> {
    const question = this.customQuestions.get(id);
    if (!question) return null;
    const updatedQuestion = { ...question, ...updates };
    this.customQuestions.set(id, updatedQuestion);
    return updatedQuestion;
  }

  async deleteCustomQuestion(id: number): Promise<boolean> {
    return this.customQuestions.delete(id);
  }

  // Standard Questions
  async getStandardQuestion(id: number): Promise<any | null> {
    return this.standardQuestions.get(id) || null;
  }

  async getStandardQuestionsByAppointmentType(appointmentTypeId: number): Promise<any[]> {
    return Array.from(this.standardQuestions.values()).filter(q => q.appointmentTypeId === appointmentTypeId);
  }

  async createStandardQuestion(questionData: any): Promise<any> {
    const question = {
      id: Math.floor(Math.random() * 1000),
      ...questionData,
      createdAt: new Date(),
    };
    this.standardQuestions.set(question.id, question);
    return question;
  }

  async createStandardQuestionWithId(questionData: any): Promise<any> {
    const question = {
      ...questionData,
      createdAt: new Date(),
    };
    this.standardQuestions.set(question.id, question);
    return question;
  }

  async updateStandardQuestion(id: number, updates: any): Promise<any | null> {
    const question = this.standardQuestions.get(id);
    if (!question) return null;
    const updatedQuestion = { ...question, ...updates };
    this.standardQuestions.set(id, updatedQuestion);
    return updatedQuestion;
  }

  async deleteStandardQuestion(id: number): Promise<boolean> {
    return this.standardQuestions.delete(id);
  }

  // Booking Pages
  async getBookingPage(id: number): Promise<any | null> {
    return this.bookingPages.get(id) || null;
  }

  async getBookingPageBySlug(slug: string): Promise<any | null> {
    return Array.from(this.bookingPages.values()).find(page => page.slug === slug) || null;
  }

  async getBookingPages(): Promise<any[]> {
    return Array.from(this.bookingPages.values());
  }

  async createBookingPage(pageData: any): Promise<any> {
    const page = {
      id: Math.floor(Math.random() * 1000),
      ...pageData,
      createdAt: new Date(),
    };
    this.bookingPages.set(page.id, page);
    return page;
  }

  async updateBookingPage(id: number, updates: any): Promise<any | null> {
    const page = this.bookingPages.get(id);
    if (!page) return null;
    const updatedPage = { ...page, ...updates };
    this.bookingPages.set(id, updatedPage);
    return updatedPage;
  }

  async deleteBookingPage(id: number): Promise<boolean> {
    return this.bookingPages.delete(id);
  }

  // Assets
  async getAsset(id: number): Promise<any | null> {
    return this.assets.get(id) || null;
  }

  async getAssets(): Promise<any[]> {
    return Array.from(this.assets.values());
  }

  async getAssetsByUser(userId: number): Promise<any[]> {
    return Array.from(this.assets.values()).filter(asset => asset.userId === userId);
  }

  async createAsset(assetData: any): Promise<any> {
    const asset = {
      id: Math.floor(Math.random() * 1000),
      ...assetData,
    };
    this.assets.set(asset.id, asset);
    return asset;
  }

  async updateAsset(id: number, updates: any): Promise<any | null> {
    const asset = this.assets.get(id);
    if (!asset) return null;
    const updatedAsset = { ...asset, ...updates };
    this.assets.set(id, updatedAsset);
    return updatedAsset;
  }

  async deleteAsset(id: number): Promise<boolean> {
    return this.assets.delete(id);
  }

  // Organization default hours - for availability tests
  setOrganizationDefaultHours(tenantId: number, hours: any[]): void {
    this.organizationDefaultHours.set(tenantId, hours);
  }

  async getOrganizationDefaultHours(tenantId: number): Promise<any[]> {
    return this.organizationDefaultHours.get(tenantId) || [];
  }

  async updateOrganizationDefaultHours(tenantId: number, data: any): Promise<any> {
    this.organizationDefaultHours.set(tenantId, data);
    return data;
  }

  // Organization holidays - for availability tests
  setOrganizationHolidays(tenantId: number, holidays: any[]): void {
    this.organizationHolidays.set(tenantId, holidays);
  }

  async getOrganizationHolidays(tenantId?: number): Promise<any[]> {
    if (tenantId) {
      return this.organizationHolidays.get(tenantId) || [];
    }
    return Array.from(this.organizationHolidays.values()).flat();
  }

  async createOrganizationHoliday(tenantId: number, holiday: any): Promise<any> {
    const newHoliday = {
      id: Math.floor(Math.random() * 1000),
      ...holiday,
      tenantId,
      createdAt: new Date(),
    };
    const holidays = this.organizationHolidays.get(tenantId) || [];
    holidays.push(newHoliday);
    this.organizationHolidays.set(tenantId, holidays);
    return newHoliday;
  }

  async updateOrganizationHoliday(id: number, updates: any): Promise<any | null> {
    const entries = Array.from(this.organizationHolidays.entries());
    for (const [tenantId, holidays] of entries) {
      const holidayIndex = holidays.findIndex((h: any) => h.id === id);
      if (holidayIndex !== -1) {
        const updatedHoliday = { ...holidays[holidayIndex], ...updates };
        holidays[holidayIndex] = updatedHoliday;
        this.organizationHolidays.set(tenantId, holidays);
        return updatedHoliday;
      }
    }
    return null;
  }

  async deleteOrganizationHoliday(id: number): Promise<boolean> {
    const entries = Array.from(this.organizationHolidays.entries());
    for (const [tenantId, holidays] of entries) {
      const holidayIndex = holidays.findIndex((h: any) => h.id === id);
      if (holidayIndex !== -1) {
        holidays.splice(holidayIndex, 1);
        this.organizationHolidays.set(tenantId, holidays);
        return true;
      }
    }
    return false;
  }

  // Tenant management - for availability tests
  private tenants: Map<number, any> = new Map();

  async createTenant(tenantData: any): Promise<any> {
    const tenant = {
      id: Math.floor(Math.random() * 1000),
      ...tenantData,
    };
    this.tenants.set(tenant.id, tenant);
    return tenant;
  }

  async getTenant(id: number): Promise<any | null> {
    return this.tenants.get(id) || null;
  }

  async getTenantById(id: number): Promise<any | null> {
    return this.tenants.get(id) || null;
  }

  async getTenantBySubdomain(subdomain: string): Promise<any | null> {
    return Array.from(this.tenants.values()).find(tenant => tenant.subdomain === subdomain) || null;
  }

  async getAllTenants(): Promise<any[]> {
    return Array.from(this.tenants.values());
  }

  async updateTenant(id: number, updates: any): Promise<any | null> {
    const tenant = this.tenants.get(id);
    if (!tenant) return null;
    const updatedTenant = { ...tenant, ...updates };
    this.tenants.set(id, updatedTenant);
    return updatedTenant;
  }

  async deleteTenant(id: number): Promise<boolean> {
    return this.tenants.delete(id);
  }

  // Company Assets management - for testing
  private companyAssets: Map<number, any> = new Map();

  async createCompanyAsset(assetData: any): Promise<any> {
    const asset = {
      id: Math.floor(Math.random() * 1000),
      ...assetData,
    };
    this.companyAssets.set(asset.id, asset);
    return asset;
  }

  async getCompanyAsset(id: number): Promise<any | null> {
    return this.companyAssets.get(id) || null;
  }

  async getCompanyAssetById(id: number): Promise<any | null> {
    return this.companyAssets.get(id) || null;
  }

  async getCompanyAssets(filters: any = {}): Promise<any[]> {
    let assets = Array.from(this.companyAssets.values());
    if (filters.tenantId) {
      assets = assets.filter(asset => asset.tenantId === filters.tenantId);
    }
    return assets;
  }

  async getFilteredCompanyAssets(filters: any = {}): Promise<any[]> {
    return this.getCompanyAssets(filters);
  }

  async listCompanyAssets(filters: any = {}): Promise<any[]> {
    return this.getCompanyAssets(filters);
  }

  async updateCompanyAsset(id: number, updates: any): Promise<any | null> {
    const asset = this.companyAssets.get(id);
    if (!asset) return null;
    const updatedAsset = { ...asset, ...updates };
    this.companyAssets.set(id, updatedAsset);
    return updatedAsset;
  }

  async updateCompanyAssetStatus(id: number, status: string): Promise<any | null> {
    return this.updateCompanyAsset(id, { status });
  }

  async searchCompanyAssetByBarcode(barcode: string): Promise<any | null> {
    return Array.from(this.companyAssets.values()).find(asset => asset.barcode === barcode) || null;
  }

  async deleteCompanyAsset(id: number): Promise<boolean> {
    return this.companyAssets.delete(id);
  }

  async importCompanyAssets(assets: any[]): Promise<{ total: number; created: any[] }> {
    const created = [];
    for (const assetData of assets) {
      const asset = await this.createCompanyAsset(assetData);
      created.push(asset);
    }
    return { total: created.length, created };
  }

  // User Preferences
  async getUserPreferences(userId: number, organizationId?: number): Promise<any | null> {
    const key = organizationId ? `${userId}_${organizationId}` : `${userId}`;
    return this.userPreferences.get(key) || null;
  }

  async createUserPreferences(preferencesData: any): Promise<any> {
    const preferences = {
      id: Math.floor(Math.random() * 1000),
      ...preferencesData,
    };
    const key = preferencesData.organizationId ? `${preferencesData.userId}_${preferencesData.organizationId}` : `${preferencesData.userId}`;
    this.userPreferences.set(key, preferences);
    return preferences;
  }

  async updateUserPreferences(userId: number, organizationId: number, updates: any): Promise<any | null> {
    const key = `${userId}_${organizationId}`;
    const preferences = this.userPreferences.get(key);
    if (!preferences) return null;
    const updatedPreferences = { ...preferences, ...updates };
    this.userPreferences.set(key, updatedPreferences);
    return updatedPreferences;
  }

  // Organization Users and Roles
  async getUsersByOrganizationId(organizationId: number): Promise<any[]> {
    return Array.from(this.users.values()).filter(user => user.tenantId === organizationId);
  }

  async getOrganizationUsers(organizationId: number): Promise<any[]> {
    return Array.from(this.organizationUsers.values()).filter(ou => ou.organizationId === organizationId);
  }

  async getOrganizationUsersWithRoles(organizationId: number): Promise<any[]> {
    return Array.from(this.organizationUsers.values()).filter(ou => ou.organizationId === organizationId);
  }

  async getUserOrganizationRole(userId: number, organizationId: number): Promise<any | null> {
    return Array.from(this.organizationUsers.values()).find(ou => ou.userId === userId && ou.organizationId === organizationId) || null;
  }

  async addUserToOrganization(orgUserData: any): Promise<any> {
    const orgUser = {
      id: Math.floor(Math.random() * 1000),
      ...orgUserData,
    };
    this.organizationUsers.set(orgUser.id, orgUser);
    return orgUser;
  }

  async addUserToOrganizationWithRole(userId: number, organizationId: number, roleId: number): Promise<any> {
    return this.addUserToOrganization({ userId, organizationId, roleId });
  }

  async removeUserFromOrganization(userId: number, organizationId: number): Promise<boolean> {
    const orgUser = Array.from(this.organizationUsers.values()).find(ou => ou.userId === userId && ou.organizationId === organizationId);
    if (!orgUser) return false;
    return this.organizationUsers.delete(orgUser.id);
  }

  // Roles
  async getRole(id: number): Promise<any | null> {
    return this.roles.get(id) || null;
  }

  async getRoleById(id: number): Promise<any | null> {
    return this.roles.get(id) || null;
  }

  async getRoleByName(name: string): Promise<any | null> {
    return Array.from(this.roles.values()).find(role => role.name === name) || null;
  }

  async getRoles(): Promise<any[]> {
    return Array.from(this.roles.values());
  }

  async createRole(roleData: any): Promise<any> {
    const role = {
      id: Math.floor(Math.random() * 1000),
      ...roleData,
    };
    this.roles.set(role.id, role);
    return role;
  }

  // Organization Modules
  async getOrganizationModules(organizationId: number): Promise<any[]> {
    return Array.from(this.organizationModules.values()).filter(om => om.organizationId === organizationId);
  }

  async updateOrganizationModules(organizationId: number, modules: any[]): Promise<any[]> {
    const updated = [];
    for (const moduleData of modules) {
      const module = {
        id: Math.floor(Math.random() * 1000),
        organizationId,
        ...moduleData,
      };
      this.organizationModules.set(module.id, module);
      updated.push(module);
    }
    return updated;
  }

  async updateOrganizationModule(organizationId: number, moduleName: string, enabled: boolean): Promise<any | null> {
    const module = Array.from(this.organizationModules.values()).find(m => m.organizationId === organizationId && m.moduleName === moduleName);
    if (!module) return null;
    module.enabled = enabled;
    this.organizationModules.set(module.id, module);
    return module;
  }

  // Appointment Type Fields
  async getAppointmentTypeFields(organizationId: number): Promise<any[]> {
    return []; // Mock implementation
  }

  // Activity Logs
  async logOrganizationActivity(data: any): Promise<any> {
    const log = {
      id: Math.floor(Math.random() * 1000),
      ...data,
      timestamp: new Date(),
    };
    this.activityLogs.set(log.id, log);
    return log;
  }

  async getOrganizationLogs(organizationId: number, page?: number, pageSize?: number): Promise<any[]> {
    return Array.from(this.activityLogs.values()).filter(log => log.organizationId === organizationId);
  }

  // OCR Jobs
  async createOcrJob(ocrJobData: any): Promise<any> {
    const job = {
      id: Math.floor(Math.random() * 1000),
      ...ocrJobData,
      createdAt: new Date(),
    };
    this.ocrJobs.set(job.id, job);
    return job;
  }

  async getOcrJob(id: number): Promise<any | null> {
    return this.ocrJobs.get(id) || null;
  }

  async getOcrJobsByStatus(status: string): Promise<any[]> {
    return Array.from(this.ocrJobs.values()).filter(job => job.status === status);
  }

  async updateOcrJob(id: number, updates: any): Promise<any | null> {
    const job = this.ocrJobs.get(id);
    if (!job) return null;
    const updatedJob = { ...job, ...updates };
    this.ocrJobs.set(id, updatedJob);
    return updatedJob;
  }

  // Utility methods
  reset(): void {
    this.fileRecords.clear();
    this.bolDocuments.clear();
    this.schedules.clear();
    this.users.clear();
    this.organizations.clear();
    this.facilities.clear();
    this.appointmentTypes.clear();
    this.organizationDefaultHours.clear();
    this.organizationHolidays.clear();
    this.tenants.clear();
    this.companyAssets.clear();
    this.docks.clear();
    this.carriers.clear();
    this.notifications.clear();
    this.appointmentSettings.clear();
    this.dailyAvailability.clear();
    this.customQuestions.clear();
    this.standardQuestions.clear();
    this.bookingPages.clear();
    this.assets.clear();
    this.roles.clear();
    this.organizationUsers.clear();
    this.organizationModules.clear();
    this.userPreferences.clear();
    this.ocrJobs.clear();
    this.activityLogs.clear();
    this.nextBolId = 1;
    this.nextScheduleId = 1;
    this.nextUserId = 1;
  }

  // Seed with some test data
  seed(): void {
    // Create test user
    this.createUser({
      username: 'testuser',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'admin',
      tenantId: 1,
    });

    // Create test schedule
    this.createSchedule({
      facilityId: 1,
      truckNumber: 'TRUCK001',
      startTime: new Date('2024-01-01T08:00:00Z'),
      endTime: new Date('2024-01-01T17:00:00Z'),
      type: 'loading',
      status: 'scheduled',
      createdBy: 1,
    });
  }
}

// Export singleton instance
export const mockStorage = new MockStorage();

// Mock the getStorage function
export const getStorage = vi.fn().mockResolvedValue(mockStorage);

export default mockStorage; 