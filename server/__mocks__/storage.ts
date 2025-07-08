import { vi } from 'vitest';

export class MockStorage {
  private fileRecords: any[] = [];
  private bolDocuments: any[] = [];
  private schedules: any[] = [];
  private users: any[] = [];
  private tenants: any[] = [];
  private companyAssets: any[] = [];

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

  // Tenant methods
  async createTenant(data: any) {
    const tenant = { id: Math.floor(Math.random() * 1000), ...data };
    this.tenants.push(tenant);
    return tenant;
  }

  async getTenant(id: number) {
    return this.tenants.find(tenant => tenant.id === id);
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

  // Utility methods
  reset() {
    this.fileRecords = [];
    this.bolDocuments = [];
    this.schedules = [];
    this.users = [];
    this.tenants = [];
    this.companyAssets = [];
  }

  seed(data: any = {}) {
    if (data.tenants) this.tenants = [...data.tenants];
    if (data.users) this.users = [...data.users];
    if (data.schedules) this.schedules = [...data.schedules];
    if (data.fileRecords) this.fileRecords = [...data.fileRecords];
    if (data.bolDocuments) this.bolDocuments = [...data.bolDocuments];
    if (data.companyAssets) this.companyAssets = [...data.companyAssets];
  }
}

// Create default mock instance
export const mockStorage = new MockStorage();

// Mock the getStorage function
export const getStorage = vi.fn().mockResolvedValue(mockStorage);

// Export default instance for easy importing
export default mockStorage; 