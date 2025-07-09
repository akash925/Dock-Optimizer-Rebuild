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
  async createSchedule(scheduleData: Omit<Schedule, 'id' | 'createdAt'>): Promise<Schedule> {
    const schedule: Schedule = {
      id: this.nextScheduleId++,
      ...scheduleData,
      createdAt: new Date(),
    };
    this.schedules.set(schedule.id, schedule);
    return schedule;
  }

  async getSchedule(id: number): Promise<Schedule | null> {
    return this.schedules.get(id) || null;
  }

  async getSchedulesByFacility(facilityId: number): Promise<Schedule[]> {
    return Array.from(this.schedules.values()).filter(schedule => schedule.facilityId === facilityId);
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
  async createUser(userData: Omit<User, 'id' | 'createdAt'>): Promise<User> {
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

  async updateUser(id: number, updates: Partial<User>): Promise<User | null> {
    const user = this.users.get(id);
    if (!user) return null;

    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }

  // Organization management - for availability tests
  setOrganization(id: number, organizationData: any): void {
    this.organizations.set(id, organizationData);
  }

  async getOrganizationByFacilityId(facilityId: number): Promise<any | null> {
    const facility = this.facilities.get(facilityId);
    if (!facility) return null;
    return this.organizations.get(facility.tenantId) || null;
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

  async createFacility(facilityData: any): Promise<any> {
    const facility = {
      id: Math.floor(Math.random() * 1000),
      ...facilityData,
    };
    this.facilities.set(facility.id, facility);
    return facility;
  }

  // Appointment type management - for availability tests
  setAppointmentType(id: number, appointmentTypeData: any): void {
    this.appointmentTypes.set(id, appointmentTypeData);
  }

  async getAppointmentType(id: number): Promise<any | null> {
    return this.appointmentTypes.get(id) || null;
  }

  async createAppointmentType(appointmentTypeData: any): Promise<any> {
    const appointmentType = {
      id: Math.floor(Math.random() * 1000),
      ...appointmentTypeData,
    };
    this.appointmentTypes.set(appointmentType.id, appointmentType);
    return appointmentType;
  }

  // Organization default hours - for availability tests
  setOrganizationDefaultHours(tenantId: number, hours: any[]): void {
    this.organizationDefaultHours.set(tenantId, hours);
  }

  async getOrganizationDefaultHours(tenantId: number): Promise<any[]> {
    return this.organizationDefaultHours.get(tenantId) || [];
  }

  // Organization holidays - for availability tests
  setOrganizationHolidays(tenantId: number, holidays: any[]): void {
    this.organizationHolidays.set(tenantId, holidays);
  }

  async getOrganizationHolidays(tenantId: number): Promise<any[]> {
    return this.organizationHolidays.get(tenantId) || [];
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