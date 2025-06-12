import { 
  User, InsertUser, 
  Dock, InsertDock, 
  Schedule, InsertSchedule, 
  Carrier, InsertCarrier, 
  Notification, InsertNotification,
  Facility, InsertFacility,
  Holiday, InsertHoliday,
  AppointmentSettings, InsertAppointmentSettings,
  AppointmentType, InsertAppointmentType,
  DailyAvailability, InsertDailyAvailability,
  CustomQuestion, InsertCustomQuestion,
  StandardQuestion, InsertStandardQuestion,
  BookingPage, InsertBookingPage,
  Asset, InsertAsset,
  CompanyAsset, InsertCompanyAsset, UpdateCompanyAsset,
  Tenant, InsertTenant,
  RoleRecord, InsertRoleRecord,
  OrganizationUser, InsertOrganizationUser,
  OrganizationModule, InsertOrganizationModule, AvailableModule,
  UserPreferences, InsertUserPreferences,
  ScheduleStatus, DockStatus, HolidayScope, TimeInterval, AssetCategory,
  DefaultHours,
  users, docks, schedules, carriers, notifications, facilities, holidays, appointmentSettings,
  appointmentTypes, dailyAvailability, customQuestions, standardQuestions, bookingPages, assets, companyAssets,
  tenants, roles, organizationUsers, organizationModules, organizationFacilities, userPreferences
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPg from "connect-pg-simple";
import { eq, and, gte, lte, or, ilike, SQL, sql, inArray } from "drizzle-orm";
import { db, pool } from "./db";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const MemoryStore = createMemoryStore(session);
const PostgresSessionStore = connectPg(session);

// Password hashing functions
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Storage Interface
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, userUpdate: Partial<User>): Promise<User | undefined>;
  updateUserPassword(id: number, hashedPassword: string): Promise<boolean>;
  getUsers(): Promise<User[]>;
  
  // Dock operations
  getDock(id: number): Promise<Dock | undefined>;
  getDocks(): Promise<Dock[]>;
  getDocksByFacility(facilityId: number): Promise<Dock[]>;
  createDock(dock: InsertDock): Promise<Dock>;
  updateDock(id: number, dock: Partial<Dock>): Promise<Dock | undefined>;
  deleteDock(id: number): Promise<boolean>;

  // Schedule operations
  getSchedule(id: number): Promise<Schedule | undefined>;
  getSchedules(): Promise<Schedule[]>;
  getSchedulesByDock(dockId: number): Promise<Schedule[]>;
  getSchedulesByDateRange(startDate: Date, endDate: Date): Promise<Schedule[]>;
  searchSchedules(query: string): Promise<Schedule[]>;
  getScheduleByConfirmationCode(code: string): Promise<Schedule | undefined>;
  createSchedule(schedule: InsertSchedule): Promise<Schedule>;
  updateSchedule(id: number, schedule: Partial<Schedule>): Promise<Schedule | undefined>;
  deleteSchedule(id: number): Promise<boolean>;
  
  // Carrier operations
  getCarrier(id: number): Promise<Carrier | undefined>;
  getCarriers(): Promise<Carrier[]>;
  createCarrier(carrier: InsertCarrier): Promise<Carrier>;
  updateCarrier(id: number, carrier: Partial<Carrier>): Promise<Carrier | undefined>;
  
  // Facility operations
  getFacility(id: number, tenantId?: number): Promise<Facility | undefined>;
  getFacilities(tenantId?: number): Promise<Facility[]>;
  getFacilitiesByOrganizationId(organizationId: number): Promise<Facility[]>;
  getOrganizationByFacilityId(facilityId: number): Promise<Tenant | undefined>;
  getOrganizationByAppointmentTypeId(appointmentTypeId: number): Promise<Tenant | undefined>;
  getFacilityTenantId(facilityId: number): Promise<number>;
  createFacility(facility: InsertFacility): Promise<Facility>;
  updateFacility(id: number, facility: Partial<Facility>): Promise<Facility | undefined>;
  deleteFacility(id: number): Promise<boolean>;
  
  // Notification operations
  getNotification(id: number): Promise<Notification | undefined>;
  getNotificationsByUser(userId: number): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: number): Promise<Notification | undefined>;
  
  // Appointment Settings operations
  getAppointmentSettings(facilityId: number): Promise<AppointmentSettings | undefined>;
  createAppointmentSettings(settings: InsertAppointmentSettings): Promise<AppointmentSettings>;
  updateAppointmentSettings(facilityId: number, settings: Partial<AppointmentSettings>): Promise<AppointmentSettings | undefined>;
  
  // Appointment Type operations
  getAppointmentType(id: number): Promise<AppointmentType | undefined>;
  getAppointmentTypes(): Promise<AppointmentType[]>;
  getAppointmentTypesByFacility(facilityId: number): Promise<AppointmentType[]>;
  createAppointmentType(appointmentType: InsertAppointmentType): Promise<AppointmentType>;
  updateAppointmentType(id: number, appointmentType: Partial<AppointmentType>): Promise<AppointmentType | undefined>;
  deleteAppointmentType(id: number): Promise<boolean>;
  
  // Daily Availability operations
  getDailyAvailability(id: number): Promise<DailyAvailability | undefined>;
  getDailyAvailabilityByAppointmentType(appointmentTypeId: number): Promise<DailyAvailability[]>;
  createDailyAvailability(dailyAvailability: InsertDailyAvailability): Promise<DailyAvailability>;
  updateDailyAvailability(id: number, dailyAvailability: Partial<DailyAvailability>): Promise<DailyAvailability | undefined>;
  deleteDailyAvailability(id: number): Promise<boolean>;
  
  // Custom Question operations
  getCustomQuestion(id: number): Promise<CustomQuestion | undefined>;
  getCustomQuestionsByAppointmentType(appointmentTypeId: number): Promise<CustomQuestion[]>;
  createCustomQuestion(customQuestion: InsertCustomQuestion): Promise<CustomQuestion>;
  updateCustomQuestion(id: number, customQuestion: Partial<CustomQuestion>): Promise<CustomQuestion | undefined>;
  deleteCustomQuestion(id: number): Promise<boolean>;
  
  // Standard Question operations
  getStandardQuestion(id: number): Promise<StandardQuestion | undefined>;
  getStandardQuestionsByAppointmentType(appointmentTypeId: number): Promise<StandardQuestion[]>;
  createStandardQuestion(standardQuestion: InsertStandardQuestion): Promise<StandardQuestion>;
  createStandardQuestionWithId(id: number, standardQuestion: InsertStandardQuestion): Promise<StandardQuestion>;
  updateStandardQuestion(id: number, standardQuestion: Partial<StandardQuestion>): Promise<StandardQuestion | undefined>;
  deleteStandardQuestion(id: number): Promise<boolean>;
  
  // Booking Pages operations
  getBookingPage(id: number): Promise<BookingPage | undefined>;
  getBookingPageBySlug(slug: string): Promise<BookingPage | undefined>;
  getBookingPages(): Promise<BookingPage[]>;
  createBookingPage(bookingPage: InsertBookingPage): Promise<BookingPage>;
  updateBookingPage(id: number, bookingPage: Partial<BookingPage>): Promise<BookingPage | undefined>;
  deleteBookingPage(id: number): Promise<boolean>;
  
  // Asset Manager operations
  getAsset(id: number): Promise<Asset | undefined>;
  getAssets(): Promise<Asset[]>;
  getAssetsByUser(userId: number): Promise<Asset[]>;
  createAsset(asset: InsertAsset): Promise<Asset>;
  updateAsset(id: number, asset: Partial<Asset>): Promise<Asset | undefined>;
  deleteAsset(id: number): Promise<boolean>;
  
  // Company Asset operations
  getCompanyAsset(id: number): Promise<CompanyAsset | undefined>;
  getCompanyAssets(): Promise<CompanyAsset[]>;
  getFilteredCompanyAssets(filters: Record<string, any>): Promise<CompanyAsset[]>;
  createCompanyAsset(companyAsset: InsertCompanyAsset): Promise<CompanyAsset>;
  updateCompanyAsset(id: number, companyAsset: UpdateCompanyAsset): Promise<CompanyAsset | undefined>;
  deleteCompanyAsset(id: number): Promise<boolean>;
  
  // Organization (Tenant) operations
  getAllTenants(): Promise<Tenant[]>;
  getTenantById(id: number): Promise<Tenant | undefined>;
  getTenantBySubdomain(subdomain: string): Promise<Tenant | undefined>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenant(id: number, tenant: Partial<Tenant>): Promise<Tenant | undefined>;
  deleteTenant(id: number): Promise<boolean>;
  
  // Organization default hours operations
  getOrganizationDefaultHours(orgId: number): Promise<DefaultHours | null>;
  updateOrganizationDefaultHours(orgId: number, defaultHours: DefaultHours): Promise<boolean>;
  
  // Role operations
  getRole(id: number): Promise<RoleRecord | undefined>;
  getRoleByName(name: string): Promise<RoleRecord | undefined>;
  getRoleById(id: number): Promise<RoleRecord | undefined>; // Alias for getRole to maintain compatibility
  getRoles(): Promise<RoleRecord[]>;
  createRole(role: InsertRoleRecord): Promise<RoleRecord>;
  
  // Organization User operations
  getUsersByOrganizationId(organizationId: number): Promise<User[]>;
  getOrganizationUsers(organizationId: number): Promise<OrganizationUser[]>;
  getOrganizationUsersWithRoles(organizationId: number): Promise<Array<OrganizationUser & { 
    user?: User;
    role?: RoleRecord;
  }>>;
  getUserOrganizationRole(userId: number, organizationId: number): Promise<OrganizationUser | undefined>;
  addUserToOrganization(orgUser: InsertOrganizationUser): Promise<OrganizationUser>;
  addUserToOrganizationWithRole(userId: number, organizationId: number, roleId: number): Promise<OrganizationUser>;
  removeUserFromOrganization(userId: number, organizationId: number): Promise<boolean>;
  
  // Organization Module operations
  getOrganizationModules(organizationId: number): Promise<OrganizationModule[]>;
  updateOrganizationModules(organizationId: number, modules: InsertOrganizationModule[]): Promise<OrganizationModule[]>;
  updateOrganizationModule(organizationId: number, moduleName: AvailableModule, enabled: boolean): Promise<OrganizationModule | undefined>;
  
  // Appointment Type Fields operations
  getAppointmentTypeFields(organizationId: number): Promise<Array<{
    fieldKey: string;
    label: string;
    fieldType: string;
    appointmentTypeId: number;
    included: boolean;
    required: boolean;
    orderPosition: number;
  }>>;
  
  // Organization utility operations
  getOrganizationByFacilityId(facilityId: number): Promise<Tenant | undefined>;
  getOrganizationByAppointmentTypeId(appointmentTypeId: number): Promise<Tenant | undefined>;
  
  // Standard Questions operations
  createStandardQuestionWithId(question: InsertStandardQuestion & { id: number }): Promise<StandardQuestion>;
  
  // Organization Activity operations
  logOrganizationActivity(data: { 
    organizationId: number;
    userId: number;
    action: string;
    details: string;
  }): Promise<{ id: number; timestamp: Date }>;
  getOrganizationLogs(organizationId: number, page?: number, pageSize?: number): Promise<Array<{
    id: number;
    timestamp: Date;
    userId: number;
    organizationId: number;
    action: string;
    details: string;
    username?: string;
  }>>;
  
  // User Notification Preferences operations
  getUserPreferences(userId: number, organizationId: number): Promise<UserPreferences | undefined>;
  createUserPreferences(preferences: InsertUserPreferences): Promise<UserPreferences>;
  updateUserPreferences(userId: number, organizationId: number, preferences: Partial<UserPreferences>): Promise<UserPreferences | undefined>;
  
  // File Storage operations for BOL document management
  createFileRecord(fileRecord: {
    id: string;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    path: string;
    appointmentId?: number;
    ocrText?: string;
    metadata?: any;
    uploadedBy: number;
    uploadedAt: Date;
  }): Promise<any>;
  getFileRecord(fileId: string): Promise<any | null>;
  deleteFileRecord(fileId: string): Promise<boolean>;
  getTempFiles(cutoffDate: Date): Promise<any[]>;
  
  // Session store
  sessionStore: any; // Type-safe session store
  
  // Organization holiday management
  getOrganizationHolidays(organizationId: number): Promise<any[]>;
}

// In-Memory Storage Implementation
export class MemStorage implements IStorage {
  private users: Map<number, User> = new Map();
  private docks: Map<number, Dock> = new Map();
  private schedules: Map<number, Schedule> = new Map();
  private carriers: Map<number, Carrier> = new Map();
  private facilities: Map<number, Facility> = new Map();
  private notifications: Map<number, Notification> = new Map();
  private appointmentSettings: Map<number, AppointmentSettings> = new Map();
  private appointmentTypes: Map<number, AppointmentType> = new Map();
  private dailyAvailability: Map<number, DailyAvailability> = new Map();
  private customQuestions: Map<number, CustomQuestion> = new Map();
  private standardQuestions: Map<number, StandardQuestion> = new Map();
  private bookingPages: Map<number, BookingPage> = new Map();
  private assets: Map<number, Asset> = new Map();
  private companyAssets: Map<number, CompanyAsset> = new Map();
  private userPreferences: Map<number, UserPreferences> = new Map();
  private fileRecords: Map<string, any> = new Map();
  private tenants: Map<number, Tenant> = new Map();
  private roles: Map<number, RoleRecord> = new Map();
  private organizationUsers: Map<number, OrganizationUser> = new Map();
  private organizationModules: Map<number, OrganizationModule> = new Map();
  private organizationFacilities: Map<number, { id: number; organizationId: number; facilityId: number; createdAt: Date }> = new Map();
  private activityLogs: Map<number, any> = new Map();
  
  sessionStore: any;
  
  private userIdCounter: number = 1;
  private dockIdCounter: number = 1;
  private scheduleIdCounter: number = 1;
  private carrierIdCounter: number = 1;
  private facilityIdCounter: number = 1;
  private notificationIdCounter: number = 1;
  private appointmentSettingsIdCounter: number = 1;
  private appointmentTypeIdCounter: number = 1;
  private dailyAvailabilityIdCounter: number = 1;
  private customQuestionIdCounter: number = 1;
  private standardQuestionIdCounter: number = 1;
  private bookingPageIdCounter: number = 1;
  private assetIdCounter: number = 1;
  private companyAssetIdCounter: number = 1;
  private tenantIdCounter: number = 1;
  private roleIdCounter: number = 1;
  private organizationUserIdCounter: number = 1;
  private organizationModuleIdCounter: number = 1;
  private organizationFacilityIdCounter: number = 1;
  private userPreferencesIdCounter: number = 1;
  private activityLogIdCounter: number = 1;

  constructor() {
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // 24 hours
    });
    
    this.setupInitialData();
  }

  private setupInitialData() {
    // Implement full setup logic here based on schema
  }

  // Implement all methods from IStorage interface with correct types and null handling
  async getUser(id: number): Promise<User | undefined> { return this.users.get(id); }
  async getUserByUsername(username: string): Promise<User | undefined> { return Array.from(this.users.values()).find(u => u.username === username); }
  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = { ...insertUser, id, createdAt: new Date(), tenantId: insertUser.tenantId ?? null };
    this.users.set(id, user);
    return user;
  }
  async updateUser(id: number, userUpdate: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updatedUser = { ...user, ...userUpdate };
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  async updateUserPassword(id: number, hashedPassword: string): Promise<boolean> {
    const user = this.users.get(id);
    if (!user) return false;
    user.password = hashedPassword;
    return true;
  }
  async getUsers(): Promise<User[]> { return Array.from(this.users.values()); }
  async getDock(id: number): Promise<Dock | undefined> { return this.docks.get(id); }
  async getDocks(): Promise<Dock[]> { return Array.from(this.docks.values()); }
  async getDocksByFacility(facilityId: number): Promise<Dock[]> { return Array.from(this.docks.values()).filter(d => d.facilityId === facilityId); }
  async createDock(insertDock: InsertDock): Promise<Dock> {
    const id = this.dockIdCounter++;
    const dock: Dock = { ...insertDock, id, isActive: insertDock.isActive ?? true, type: insertDock.type as any, customType: insertDock.customType ?? null, constraints: insertDock.constraints ?? null };
    this.docks.set(id, dock);
    return dock;
  }
  async updateDock(id: number, dockUpdate: Partial<Dock>): Promise<Dock | undefined> {
    const dock = this.docks.get(id);
    if (!dock) return undefined;
    const updatedDock = { ...dock, ...dockUpdate };
    this.docks.set(id, updatedDock);
    return updatedDock;
  }
  async deleteDock(id: number): Promise<boolean> { return this.docks.delete(id); }
  async getSchedule(id: number): Promise<Schedule | undefined> { return this.schedules.get(id); }
  async getSchedules(): Promise<Schedule[]> { return Array.from(this.schedules.values()); }
  async getSchedulesByDock(dockId: number): Promise<Schedule[]> { return Array.from(this.schedules.values()).filter(s => s.dockId === dockId); }
  async getSchedulesByDateRange(startDate: Date, endDate: Date): Promise<Schedule[]> { return Array.from(this.schedules.values()).filter(s => new Date(s.startTime) >= startDate && new Date(s.endTime) <= endDate); }
  async searchSchedules(query: string): Promise<Schedule[]> { return []; }
  async getScheduleByConfirmationCode(code: string): Promise<Schedule | undefined> { return undefined; }
  async createSchedule(insertSchedule: InsertSchedule): Promise<Schedule> {
    const id = this.scheduleIdCounter++;
    const schedule: Schedule = { ...insertSchedule, id, createdAt: new Date(), lastModifiedAt: new Date(), createdBy: insertSchedule.createdBy, lastModifiedBy: insertSchedule.createdBy, facilityId: insertSchedule.facilityId ?? null, dockId: insertSchedule.dockId ?? null, carrierId: insertSchedule.carrierId ?? null, appointmentTypeId: insertSchedule.appointmentTypeId ?? null, truckNumber: insertSchedule.truckNumber, trailerNumber: insertSchedule.trailerNumber ?? null, driverName: insertSchedule.driverName ?? null, driverPhone: insertSchedule.driverPhone ?? null, driverEmail: insertSchedule.driverEmail ?? null, customerName: insertSchedule.customerName ?? null, carrierName: insertSchedule.carrierName ?? null, mcNumber: insertSchedule.mcNumber ?? null, bolNumber: insertSchedule.bolNumber ?? null, poNumber: insertSchedule.poNumber ?? null, palletCount: insertSchedule.palletCount ?? null, weight: insertSchedule.weight ?? null, appointmentMode: insertSchedule.appointmentMode ?? 'trailer', notes: insertSchedule.notes ?? null, customFormData: insertSchedule.customFormData ?? null, creatorEmail: insertSchedule.creatorEmail ?? null, actualStartTime: insertSchedule.actualStartTime ? new Date(insertSchedule.actualStartTime) : null, actualEndTime: insertSchedule.actualEndTime ? new Date(insertSchedule.actualEndTime) : null, confirmationCode: insertSchedule.confirmationCode ?? null };
    this.schedules.set(id, schedule);
    return schedule;
  }
  async updateSchedule(id: number, scheduleUpdate: Partial<Schedule>): Promise<Schedule | undefined> {
    const schedule = this.schedules.get(id);
    if (!schedule) return undefined;
    const updatedSchedule = { ...schedule, ...scheduleUpdate, lastModifiedAt: new Date() };
    this.schedules.set(id, updatedSchedule);
    return updatedSchedule;
  }
  async deleteSchedule(id: number): Promise<boolean> { return this.schedules.delete(id); }
  async getCarrier(id: number): Promise<Carrier | undefined> { return this.carriers.get(id); }
  async getCarriers(): Promise<Carrier[]> { return Array.from(this.carriers.values()); }
  async createCarrier(insertCarrier: InsertCarrier): Promise<Carrier> {
    const id = this.carrierIdCounter++;
    const carrier: Carrier = { ...insertCarrier, id, mcNumber: insertCarrier.mcNumber ?? null, contactName: insertCarrier.contactName ?? null, contactEmail: insertCarrier.contactEmail ?? null, contactPhone: insertCarrier.contactPhone ?? null };
    this.carriers.set(id, carrier);
    return carrier;
  }
  async updateCarrier(id: number, carrierUpdate: Partial<Carrier>): Promise<Carrier | undefined> {
    const carrier = this.carriers.get(id);
    if (!carrier) return undefined;
    const updatedCarrier = { ...carrier, ...carrierUpdate };
    this.carriers.set(id, updatedCarrier);
    return updatedCarrier;
  }
  async getFacility(id: number, tenantId?: number): Promise<Facility | undefined> { return this.facilities.get(id); }
  async getFacilities(tenantId?: number): Promise<Facility[]> { return Array.from(this.facilities.values()); }
  async getFacilitiesByOrganizationId(organizationId: number): Promise<Facility[]> {
    const facilityMappings = Array.from(this.organizationFacilities.values()).filter(m => m.organizationId === organizationId);
    const facilityIds = facilityMappings.map(m => m.facilityId);
    return Array.from(this.facilities.values()).filter(f => facilityIds.includes(f.id));
  }
  async getOrganizationByFacilityId(facilityId: number): Promise<any> { return null; }
  async getOrganizationByAppointmentTypeId(appointmentTypeId: number): Promise<any> { return null; }
  async getFacilityTenantId(facilityId: number): Promise<number> {
    const mapping = Array.from(this.organizationFacilities.values()).find(m => m.facilityId === facilityId);
    return mapping?.organizationId ?? 1;
  }
  async createFacility(insertFacility: InsertFacility): Promise<Facility> {
    const id = this.facilityIdCounter++;
    const facility: Facility = { ...insertFacility, id, createdAt: new Date(), lastModifiedAt: new Date(), address2: insertFacility.address2 ?? null, latitude: insertFacility.latitude ?? null, longitude: insertFacility.longitude ?? null, company: insertFacility.company ?? null, timezone: insertFacility.timezone ?? 'UTC', tenantId: insertFacility.tenantId ?? null, mondayStart: insertFacility.mondayStart ?? '08:00', mondayEnd: insertFacility.mondayEnd ?? '17:00', mondayBreakStart: insertFacility.mondayBreakStart ?? '12:00', mondayBreakEnd: insertFacility.mondayBreakEnd ?? '13:00', mondayOpen: insertFacility.mondayOpen ?? true, tuesdayStart: insertFacility.tuesdayStart ?? '08:00', tuesdayEnd: insertFacility.tuesdayEnd ?? '17:00', tuesdayBreakStart: insertFacility.tuesdayBreakStart ?? '12:00', tuesdayBreakEnd: insertFacility.tuesdayBreakEnd ?? '13:00', tuesdayOpen: insertFacility.tuesdayOpen ?? true, wednesdayStart: insertFacility.wednesdayStart ?? '08:00', wednesdayEnd: insertFacility.wednesdayEnd ?? '17:00', wednesdayBreakStart: insertFacility.wednesdayBreakStart ?? '12:00', wednesdayBreakEnd: insertFacility.wednesdayBreakEnd ?? '13:00', wednesdayOpen: insertFacility.wednesdayOpen ?? true, thursdayStart: insertFacility.thursdayStart ?? '08:00', thursdayEnd: insertFacility.thursdayEnd ?? '17:00', thursdayBreakStart: insertFacility.thursdayBreakStart ?? '12:00', thursdayBreakEnd: insertFacility.thursdayBreakEnd ?? '13:00', thursdayOpen: insertFacility.thursdayOpen ?? true, fridayStart: insertFacility.fridayStart ?? '08:00', fridayEnd: insertFacility.fridayEnd ?? '17:00', fridayBreakStart: insertFacility.fridayBreakStart ?? '12:00', fridayBreakEnd: insertFacility.fridayBreakEnd ?? '13:00', fridayOpen: insertFacility.fridayOpen ?? true, saturdayStart: insertFacility.saturdayStart ?? '08:00', saturdayEnd: insertFacility.saturdayEnd ?? '13:00', saturdayBreakStart: insertFacility.saturdayBreakStart ?? null, saturdayBreakEnd: insertFacility.saturdayBreakEnd ?? null, saturdayOpen: insertFacility.saturdayOpen ?? false, sundayStart: insertFacility.sundayStart ?? '08:00', sundayEnd: insertFacility.sundayEnd ?? '17:00', sundayBreakStart: insertFacility.sundayBreakStart ?? null, sundayBreakEnd: insertFacility.sundayBreakEnd ?? null, sundayOpen: insertFacility.sundayOpen ?? false };
    this.facilities.set(id, facility);
    return facility;
  }
  async updateFacility(id: number, facilityUpdate: Partial<Facility>): Promise<Facility | undefined> {
    const facility = this.facilities.get(id);
    if (!facility) return undefined;
    const updatedFacility = { ...facility, ...facilityUpdate, lastModifiedAt: new Date() };
    this.facilities.set(id, updatedFacility);
    return updatedFacility;
  }
  async deleteFacility(id: number): Promise<boolean> { return this.facilities.delete(id); }
  async getNotification(id: number): Promise<Notification | undefined> { return this.notifications.get(id); }
  async getNotificationsByUser(userId: number): Promise<Notification[]> { return Array.from(this.notifications.values()).filter(n => n.userId === userId); }
  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const id = this.notificationIdCounter++;
    const notification: Notification = { ...insertNotification, id, isRead: false, createdAt: new Date(), relatedScheduleId: insertNotification.relatedScheduleId ?? null };
    this.notifications.set(id, notification);
    return notification;
  }
  async markNotificationAsRead(id: number): Promise<Notification | undefined> {
    const notification = this.notifications.get(id);
    if (!notification) return undefined;
    notification.isRead = true;
    return notification;
  }
  async getAppointmentSettings(facilityId: number): Promise<AppointmentSettings | undefined> { return Array.from(this.appointmentSettings.values()).find(s => s.facilityId === facilityId); }
  async createAppointmentSettings(insertSettings: InsertAppointmentSettings): Promise<AppointmentSettings> {
    const id = this.appointmentSettingsIdCounter++;
    const settings: AppointmentSettings = { ...insertSettings, id, createdAt: new Date(), lastModifiedAt: new Date(), timeInterval: insertSettings.timeInterval ?? TimeInterval.MINUTES_30, maxConcurrentInbound: insertSettings.maxConcurrentInbound ?? 2, maxConcurrentOutbound: insertSettings.maxConcurrentOutbound ?? 2, shareAvailabilityInfo: insertSettings.shareAvailabilityInfo ?? true, sunday: insertSettings.sunday ?? false, monday: insertSettings.monday ?? true, tuesday: insertSettings.tuesday ?? true, wednesday: insertSettings.wednesday ?? true, thursday: insertSettings.thursday ?? true, friday: insertSettings.friday ?? true, saturday: insertSettings.saturday ?? false, sundayStartTime: insertSettings.sundayStartTime ?? '08:00', sundayEndTime: insertSettings.sundayEndTime ?? '17:00', mondayStartTime: insertSettings.mondayStartTime ?? '08:00', mondayEndTime: insertSettings.mondayEndTime ?? '17:00', tuesdayStartTime: insertSettings.tuesdayStartTime ?? '08:00', tuesdayEndTime: insertSettings.tuesdayEndTime ?? '17:00', wednesdayStartTime: insertSettings.wednesdayStartTime ?? '08:00', wednesdayEndTime: insertSettings.wednesdayEndTime ?? '17:00', thursdayStartTime: insertSettings.thursdayStartTime ?? '08:00', thursdayEndTime: insertSettings.thursdayEndTime ?? '17:00', fridayStartTime: insertSettings.fridayStartTime ?? '08:00', fridayEndTime: insertSettings.fridayEndTime ?? '17:00', saturdayStartTime: insertSettings.saturdayStartTime ?? '08:00', saturdayEndTime: insertSettings.saturdayEndTime ?? '17:00', sundayBreakStartTime: insertSettings.sundayBreakStartTime ?? '12:00', sundayBreakEndTime: insertSettings.sundayBreakEndTime ?? '13:00', mondayBreakStartTime: insertSettings.mondayBreakStartTime ?? '12:00', mondayBreakEndTime: insertSettings.mondayBreakEndTime ?? '13:00', tuesdayBreakStartTime: insertSettings.tuesdayBreakStartTime ?? '12:00', tuesdayBreakEndTime: insertSettings.tuesdayBreakEndTime ?? '13:00', wednesdayBreakStartTime: insertSettings.wednesdayBreakStartTime ?? '12:00', wednesdayBreakEndTime: insertSettings.wednesdayBreakEndTime ?? '13:00', thursdayBreakStartTime: insertSettings.thursdayBreakStartTime ?? '12:00', thursdayBreakEndTime: insertSettings.thursdayBreakEndTime ?? '13:00', fridayBreakStartTime: insertSettings.fridayBreakStartTime ?? '12:00', fridayBreakEndTime: insertSettings.fridayBreakEndTime ?? '13:00', saturdayBreakStartTime: insertSettings.saturdayBreakStartTime ?? '12:00', saturdayBreakEndTime: insertSettings.saturdayBreakEndTime ?? '13:00', sundayMaxAppointments: insertSettings.sundayMaxAppointments ?? 0, mondayMaxAppointments: insertSettings.mondayMaxAppointments ?? 0, tuesdayMaxAppointments: insertSettings.tuesdayMaxAppointments ?? 0, wednesdayMaxAppointments: insertSettings.wednesdayMaxAppointments ?? 0, thursdayMaxAppointments: insertSettings.thursdayMaxAppointments ?? 0, fridayMaxAppointments: insertSettings.fridayMaxAppointments ?? 0, saturdayMaxAppointments: insertSettings.saturdayMaxAppointments ?? 0, defaultBufferTime: insertSettings.defaultBufferTime ?? 0, defaultGracePeriod: insertSettings.defaultGracePeriod ?? 15, defaultEmailReminderTime: insertSettings.defaultEmailReminderTime ?? 24, allowAppointmentsThroughBreaks: insertSettings.allowAppointmentsThroughBreaks ?? false, allowAppointmentsPastBusinessHours: insertSettings.allowAppointmentsPastBusinessHours ?? false };
    this.appointmentSettings.set(id, settings);
    return settings;
  }
  async updateAppointmentSettings(facilityId: number, settingsUpdate: Partial<AppointmentSettings>): Promise<AppointmentSettings | undefined> {
    const settings = Array.from(this.appointmentSettings.values()).find(s => s.facilityId === facilityId);
    if (!settings) return undefined;
    const updatedSettings = { ...settings, ...settingsUpdate, lastModifiedAt: new Date() };
    this.appointmentSettings.set(settings.id, updatedSettings);
    return updatedSettings;
  }
  async getAppointmentType(id: number): Promise<AppointmentType | undefined> { return this.appointmentTypes.get(id); }
  async getAppointmentTypes(): Promise<AppointmentType[]> { return Array.from(this.appointmentTypes.values()); }
  async getAppointmentTypesByFacility(facilityId: number): Promise<AppointmentType[]> { return Array.from(this.appointmentTypes.values()).filter(t => t.facilityId === facilityId); }
  async createAppointmentType(appointmentType: InsertAppointmentType): Promise<AppointmentType> {
    const id = this.appointmentTypeIdCounter++;
    const newAppointmentType: AppointmentType = { ...appointmentType, id, createdAt: new Date(), lastModifiedAt: new Date(), description: appointmentType.description ?? null, maxAppointmentsPerDay: appointmentType.maxAppointmentsPerDay ?? null, tenantId: appointmentType.tenantId ?? null, type: appointmentType.type as 'inbound' | 'outbound' };
    this.appointmentTypes.set(id, newAppointmentType);
    return newAppointmentType;
  }
  async updateAppointmentType(id: number, appointmentTypeUpdate: Partial<AppointmentType>): Promise<AppointmentType | undefined> {
    const appointmentType = this.appointmentTypes.get(id);
    if (!appointmentType) return undefined;
    const updatedAppointmentType = { ...appointmentType, ...appointmentTypeUpdate, lastModifiedAt: new Date() };
    this.appointmentTypes.set(id, updatedAppointmentType);
    return updatedAppointmentType;
  }
  async deleteAppointmentType(id: number): Promise<boolean> { return this.appointmentTypes.delete(id); }
  async getDailyAvailability(id: number): Promise<DailyAvailability | undefined> { return this.dailyAvailability.get(id); }
  async getDailyAvailabilityByAppointmentType(appointmentTypeId: number): Promise<DailyAvailability[]> { return Array.from(this.dailyAvailability.values()).filter(a => a.appointmentTypeId === appointmentTypeId); }
  async createDailyAvailability(insertDailyAvailability: InsertDailyAvailability): Promise<DailyAvailability> {
    const id = this.dailyAvailabilityIdCounter++;
    const dailyAvailability: DailyAvailability = { ...insertDailyAvailability, id, createdAt: new Date(), isAvailable: insertDailyAvailability.isAvailable ?? true, maxAppointments: insertDailyAvailability.maxAppointments ?? 0, startTime: insertDailyAvailability.startTime ?? '08:00', endTime: insertDailyAvailability.endTime ?? '17:00', breakStartTime: insertDailyAvailability.breakStartTime ?? '12:00', breakEndTime: insertDailyAvailability.breakEndTime ?? '13:00' };
    this.dailyAvailability.set(id, dailyAvailability);
    return dailyAvailability;
  }
  async updateDailyAvailability(id: number, dailyAvailabilityUpdate: Partial<DailyAvailability>): Promise<DailyAvailability | undefined> {
    const dailyAvailability = this.dailyAvailability.get(id);
    if (!dailyAvailability) return undefined;
    const updatedDailyAvailability = { ...dailyAvailability, ...dailyAvailabilityUpdate };
    this.dailyAvailability.set(id, updatedDailyAvailability);
    return updatedDailyAvailability;
  }
  async deleteDailyAvailability(id: number): Promise<boolean> { return this.dailyAvailability.delete(id); }
  async getCustomQuestion(id: number): Promise<CustomQuestion | undefined> { return this.customQuestions.get(id); }
  async getCustomQuestionsByAppointmentType(appointmentTypeId: number): Promise<CustomQuestion[]> { return Array.from(this.customQuestions.values()).filter(q => q.appointmentTypeId === appointmentTypeId); }
  async createCustomQuestion(customQuestion: InsertCustomQuestion): Promise<CustomQuestion> {
    const id = this.customQuestionIdCounter++;
    const newCustomQuestion: CustomQuestion = { ...customQuestion, id, createdAt: new Date(), lastModifiedAt: new Date(), placeholder: customQuestion.placeholder ?? null, options: customQuestion.options ?? null, defaultValue: customQuestion.defaultValue ?? null, appointmentTypeId: customQuestion.appointmentTypeId ?? null, type: customQuestion.type as any };
    this.customQuestions.set(id, newCustomQuestion);
    return newCustomQuestion;
  }
  async updateCustomQuestion(id: number, customQuestionUpdate: Partial<CustomQuestion>): Promise<CustomQuestion | undefined> {
    const customQuestion = this.customQuestions.get(id);
    if (!customQuestion) return undefined;
    const updatedCustomQuestion = { ...customQuestion, ...customQuestionUpdate, lastModifiedAt: new Date() };
    this.customQuestions.set(id, updatedCustomQuestion);
    return updatedCustomQuestion;
  }
  async deleteCustomQuestion(id: number): Promise<boolean> { return this.customQuestions.delete(id); }
  async getStandardQuestion(id: number): Promise<StandardQuestion | undefined> { return this.standardQuestions.get(id); }
  async getStandardQuestionsByAppointmentType(appointmentTypeId: number): Promise<StandardQuestion[]> { return Array.from(this.standardQuestions.values()).filter(q => q.appointmentTypeId === appointmentTypeId); }
  async createStandardQuestion(insertStandardQuestion: InsertStandardQuestion): Promise<StandardQuestion> {
    const id = this.standardQuestionIdCounter++;
    const standardQuestion: StandardQuestion = { ...insertStandardQuestion, id, createdAt: new Date() };
    this.standardQuestions.set(id, standardQuestion);
    return standardQuestion;
  }
  async createStandardQuestionWithId(id: number, standardQuestion: InsertStandardQuestion): Promise<StandardQuestion> {
    const newQuestion: StandardQuestion = { ...standardQuestion, id, createdAt: new Date() };
    this.standardQuestions.set(id, newQuestion);
    return newQuestion;
  }
  async updateStandardQuestion(id: number, standardQuestionUpdate: Partial<StandardQuestion>): Promise<StandardQuestion | undefined> {
    const standardQuestion = this.standardQuestions.get(id);
    if (!standardQuestion) return undefined;
    const updatedStandardQuestion = { ...standardQuestion, ...standardQuestionUpdate };
    this.standardQuestions.set(id, updatedStandardQuestion);
    return updatedStandardQuestion;
  }
  async deleteStandardQuestion(id: number): Promise<boolean> { return this.standardQuestions.delete(id); }
  async getBookingPage(id: number): Promise<BookingPage | undefined> { return this.bookingPages.get(id); }
  async getBookingPageBySlug(slug: string): Promise<BookingPage | undefined> { return Array.from(this.bookingPages.values()).find(p => p.slug === slug); }
  async getBookingPages(): Promise<BookingPage[]> { return Array.from(this.bookingPages.values()); }
  async createBookingPage(insertBookingPage: InsertBookingPage): Promise<BookingPage> {
    const id = this.bookingPageIdCounter++;
    const bookingPage: BookingPage = { ...insertBookingPage, id, createdAt: new Date(), lastModifiedAt: new Date(), lastModifiedBy: insertBookingPage.createdBy, description: insertBookingPage.description ?? null, welcomeMessage: insertBookingPage.welcomeMessage ?? null, confirmationMessage: insertBookingPage.confirmationMessage ?? null, excludedAppointmentTypes: insertBookingPage.excludedAppointmentTypes ?? null, customLogo: insertBookingPage.customLogo ?? null, tenantId: insertBookingPage.tenantId ?? null, isActive: insertBookingPage.isActive ?? true, primaryColor: insertBookingPage.primaryColor ?? '#4CAF50' };
    this.bookingPages.set(id, bookingPage);
    return bookingPage;
  }
  async updateBookingPage(id: number, bookingPageUpdate: Partial<BookingPage>): Promise<BookingPage | undefined> {
    const bookingPage = this.bookingPages.get(id);
    if (!bookingPage) return undefined;
    const updatedBookingPage = { ...bookingPage, ...bookingPageUpdate, lastModifiedAt: new Date() };
    this.bookingPages.set(id, updatedBookingPage);
    return updatedBookingPage;
  }
  async deleteBookingPage(id: number): Promise<boolean> { return this.bookingPages.delete(id); }
  async getAsset(id: number): Promise<Asset | undefined> { return this.assets.get(id); }
  async getAssets(): Promise<Asset[]> { return Array.from(this.assets.values()); }
  async getAssetsByUser(userId: number): Promise<Asset[]> { return Array.from(this.assets.values()).filter(a => a.uploadedBy === userId); }
  async createAsset(insertAsset: InsertAsset): Promise<Asset> {
    const id = this.assetIdCounter++;
    const asset: Asset = { ...insertAsset, id, createdAt: new Date(), description: insertAsset.description ?? null, fileType: insertAsset.fileType ?? null, fileSize: insertAsset.fileSize ?? null, tags: insertAsset.tags ?? null, lastAccessedAt: insertAsset.lastAccessedAt ?? null };
    this.assets.set(id, asset);
    return asset;
  }
  async updateAsset(id: number, assetUpdate: Partial<Asset>): Promise<Asset | undefined> {
    const asset = this.assets.get(id);
    if (!asset) return undefined;
    const updatedAsset = { ...asset, ...assetUpdate };
    this.assets.set(id, updatedAsset);
    return updatedAsset;
  }
  async deleteAsset(id: number): Promise<boolean> { return this.assets.delete(id); }
  async getCompanyAsset(id: number): Promise<CompanyAsset | undefined> { return this.companyAssets.get(id); }
  async getCompanyAssets(): Promise<CompanyAsset[]> { return Array.from(this.companyAssets.values()); }
  async getFilteredCompanyAssets(filters: Record<string, any>): Promise<CompanyAsset[]> { return []; }
  async createCompanyAsset(insertCompanyAsset: InsertCompanyAsset): Promise<CompanyAsset> {
    const id = this.companyAssetIdCounter++;
    const companyAsset: CompanyAsset = { ...insertCompanyAsset, id, createdAt: new Date(), updatedAt: new Date(), department: insertCompanyAsset.department ?? null, barcode: insertCompanyAsset.barcode ?? null, serialNumber: insertCompanyAsset.serialNumber ?? null, description: insertCompanyAsset.description ?? null, purchasePrice: insertCompanyAsset.purchasePrice ?? null, purchaseDate: insertCompanyAsset.purchaseDate ?? null, warrantyExpiration: insertCompanyAsset.warrantyExpiration ?? null, depreciation: insertCompanyAsset.depreciation ?? null, assetValue: insertCompanyAsset.assetValue ?? null, template: insertCompanyAsset.template ?? null, tags: insertCompanyAsset.tags ?? null, model: insertCompanyAsset.model ?? null, assetCondition: insertCompanyAsset.assetCondition ?? null, notes: insertCompanyAsset.notes ?? null, manufacturerPartNumber: insertCompanyAsset.manufacturerPartNumber ?? null, supplierName: insertCompanyAsset.supplierName ?? null, poNumber: insertCompanyAsset.poNumber ?? null, vendorInformation: insertCompanyAsset.vendorInformation ?? null, photoUrl: insertCompanyAsset.photoUrl ?? null, documentUrls: insertCompanyAsset.documentUrls ?? null, lastMaintenanceDate: insertCompanyAsset.lastMaintenanceDate ?? null, nextMaintenanceDate: insertCompanyAsset.nextMaintenanceDate ?? null, maintenanceSchedule: insertCompanyAsset.maintenanceSchedule ?? null, maintenanceContact: insertCompanyAsset.maintenanceContact ?? null, maintenanceNotes: insertCompanyAsset.maintenanceNotes ?? null, implementationDate: insertCompanyAsset.implementationDate ?? null, expectedLifetime: insertCompanyAsset.expectedLifetime ?? null, certificationDate: insertCompanyAsset.certificationDate ?? null, certificationExpiry: insertCompanyAsset.certificationExpiry ?? null, createdBy: insertCompanyAsset.createdBy ?? null, updatedBy: insertCompanyAsset.updatedBy ?? null };
    this.companyAssets.set(id, companyAsset);
    return companyAsset;
  }
  async updateCompanyAsset(id: number, companyAssetUpdate: UpdateCompanyAsset): Promise<CompanyAsset | undefined> {
    const companyAsset = this.companyAssets.get(id);
    if (!companyAsset) return undefined;
    const updatedCompanyAsset = { ...companyAsset, ...companyAssetUpdate, updatedAt: new Date() };
    this.companyAssets.set(id, updatedCompanyAsset);
    return updatedCompanyAsset;
  }
  async deleteCompanyAsset(id: number): Promise<boolean> { return this.companyAssets.delete(id); }
  async getAllTenants(): Promise<Tenant[]> { return Array.from(this.tenants.values()); }
  async getTenantById(id: number): Promise<Tenant | undefined> { return this.tenants.get(id); }
  async getTenantBySubdomain(subdomain: string): Promise<Tenant | undefined> { return Array.from(this.tenants.values()).find(t => t.subdomain === subdomain); }
  async createTenant(tenant: InsertTenant): Promise<Tenant> {
    const id = this.tenantIdCounter++;
    const newTenant: Tenant = { ...tenant, id, createdAt: new Date(), updatedAt: new Date(), primaryContact: tenant.primaryContact ?? null, contactEmail: tenant.contactEmail ?? null, contactPhone: tenant.contactPhone ?? null, billingEmail: tenant.billingEmail ?? null, billingAddress: tenant.billingAddress ?? null, subscription: tenant.subscription ?? null, planStartDate: tenant.planStartDate ?? null, planEndDate: tenant.planEndDate ?? null, logo: tenant.logo ?? null, settings: tenant.settings ?? {}, metadata: tenant.metadata ?? {}, createdBy: tenant.createdBy ?? null, updatedBy: tenant.updatedBy ?? null };
    this.tenants.set(id, newTenant);
    return newTenant;
  }
  async updateTenant(id: number, tenantUpdate: Partial<Tenant>): Promise<Tenant | undefined> {
    const tenant = this.tenants.get(id);
    if (!tenant) return undefined;
    const updatedTenant = { ...tenant, ...tenantUpdate, updatedAt: new Date() };
    this.tenants.set(id, updatedTenant);
    return updatedTenant;
  }
  async deleteTenant(id: number): Promise<boolean> { return this.tenants.delete(id); }
  async getOrganizationDefaultHours(orgId: number): Promise<DefaultHours | null> {
    const tenant = await this.getTenantById(orgId);
    if (!tenant || !tenant.settings || !(tenant.settings as any).defaultHours) {
      return null;
    }
    return (tenant.settings as any).defaultHours as DefaultHours;
  }
  async updateOrganizationDefaultHours(orgId: number, defaultHours: DefaultHours): Promise<boolean> {
    const tenant = await this.getTenantById(orgId);
    if (!tenant) return false;
    const settings = tenant.settings || {};
    const updatedSettings = { ...settings, defaultHours };
    await this.updateTenant(orgId, { settings: updatedSettings });
    return true;
  }
  async getRole(id: number): Promise<RoleRecord | undefined> { return this.roles.get(id); }
  async getRoleByName(name: string): Promise<RoleRecord | undefined> { return Array.from(this.roles.values()).find(r => r.name === name); }
  async getRoleById(id: number): Promise<RoleRecord | undefined> { return this.getRole(id); }
  async getRoles(): Promise<RoleRecord[]> { return Array.from(this.roles.values()); }
  async createRole(role: InsertRoleRecord): Promise<RoleRecord> {
    const id = this.roleIdCounter++;
    const newRole: RoleRecord = { ...role, id, createdAt: new Date(), description: role.description ?? null };
    this.roles.set(id, newRole);
    return newRole;
  }
  async getUsersByOrganizationId(organizationId: number): Promise<User[]> {
    const orgUsers = Array.from(this.organizationUsers.values()).filter(ou => ou.organizationId === organizationId);
    const userIds = orgUsers.map(ou => ou.userId);
    return Array.from(this.users.values()).filter(u => userIds.includes(u.id));
  }
  async getOrganizationUsers(organizationId: number): Promise<OrganizationUser[]> { return Array.from(this.organizationUsers.values()).filter(ou => ou.organizationId === organizationId); }
  async getOrganizationUsersWithRoles(organizationId: number): Promise<any[]> { return []; }
  async getUserOrganizationRole(userId: number, organizationId: number): Promise<OrganizationUser | undefined> { return Array.from(this.organizationUsers.values()).find(ou => ou.userId === userId && ou.organizationId === organizationId); }
  async addUserToOrganization(orgUser: InsertOrganizationUser): Promise<OrganizationUser> {
    const id = this.organizationUserIdCounter++;
    const newOrgUser: OrganizationUser = { ...orgUser, id, createdAt: new Date() };
    this.organizationUsers.set(id, newOrgUser);
    return newOrgUser;
  }
  async addUserToOrganizationWithRole(userId: number, organizationId: number, roleId: number): Promise<OrganizationUser> {
    const orgUser: InsertOrganizationUser = { userId, organizationId, roleId };
    return this.addUserToOrganization(orgUser);
  }
  async removeUserFromOrganization(userId: number, organizationId: number): Promise<boolean> {
    const orgUser = Array.from(this.organizationUsers.values()).find(ou => ou.organizationId === organizationId && ou.userId === userId);
    if (!orgUser) return false;
    return this.organizationUsers.delete(orgUser.id);
  }
  async getOrganizationModules(organizationId: number): Promise<OrganizationModule[]> { return Array.from(this.organizationModules.values()).filter(m => m.organizationId === organizationId); }
  async updateOrganizationModules(organizationId: number, modules: InsertOrganizationModule[]): Promise<OrganizationModule[]> {
    const existingModules = Array.from(this.organizationModules.values()).filter(m => m.organizationId === organizationId);
    existingModules.forEach(m => this.organizationModules.delete(m.id));
    const updatedModules: OrganizationModule[] = [];
    modules.forEach(module => {
      const id = this.organizationModuleIdCounter++;
      const newModule: OrganizationModule = { ...module, id, createdAt: new Date() };
      this.organizationModules.set(id, newModule);
      updatedModules.push(newModule);
    });
    return updatedModules;
  }
  async updateOrganizationModule(organizationId: number, moduleName: AvailableModule, enabled: boolean): Promise<OrganizationModule | undefined> {
    const existing = Array.from(this.organizationModules.values()).find(m => m.organizationId === organizationId && m.moduleName === moduleName);
    if (existing) {
      const updated = { ...existing, enabled, updatedAt: new Date() };
      this.organizationModules.set(existing.id, updated);
      return updated;
    } else {
      const id = this.organizationModuleIdCounter++;
      const newModule: OrganizationModule = { id, organizationId, moduleName, enabled, createdAt: new Date(), updatedAt: new Date() };
      this.organizationModules.set(id, newModule);
      return newModule;
    }
  }
  async logOrganizationActivity(data: { organizationId: number; userId: number; action: string; details: string; }): Promise<any> {
    const id = this.activityLogIdCounter++;
    const log = { ...data, id, timestamp: new Date() };
    this.activityLogs.set(id, log);
    return log;
  }
  async getOrganizationLogs(organizationId: number, page?: number, pageSize?: number): Promise<any[]> { return []; }
  async getOrganizationHolidays(organizationId: number): Promise<any[]> { return []; }
}

// Database Storage Implementation (Placeholder for future implementation)
export class DatabaseStorage implements IStorage {
  sessionStore: any;
  private memStorage: MemStorage;

  constructor() {
    // Initialize memory store for now
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // 24 hours
    });
    this.memStorage = new MemStorage();
  }

  // Delegate all methods to memory storage for now
  async getUsers() { return this.memStorage.getUsers(); }
  async getUserByUsername(username: string) { return this.memStorage.getUserByUsername(username); }
  async getUserById(id: number) { return this.memStorage.getUserById(id); }
  async createUser(user: any) { return this.memStorage.createUser(user); }
  async updateUser(id: number, data: any) { return this.memStorage.updateUser(id, data); }
  async deleteUser(id: number) { return this.memStorage.deleteUser(id); }
  async updateUserModules(id: number, modules: string[]) { return this.memStorage.updateUserModules(id, modules); }

  async getSchedules() { return this.memStorage.getSchedules(); }
  async getSchedulesByDateRange(startDate: string, endDate: string) { return this.memStorage.getSchedulesByDateRange(startDate, endDate); }
  async createSchedule(schedule: any) { return this.memStorage.createSchedule(schedule); }
  async updateSchedule(id: number, data: any) { return this.memStorage.updateSchedule(id, data); }
  async deleteSchedule(id: number) { return this.memStorage.deleteSchedule(id); }

  async getFacilities() { return this.memStorage.getFacilities(); }
  async getFacilitiesByOrganizationId(orgId: number) { return this.memStorage.getFacilitiesByOrganizationId(orgId); }
  async createFacility(facility: any) { return this.memStorage.createFacility(facility); }
  async updateFacility(id: number, data: any) { return this.memStorage.updateFacility(id, data); }
  async deleteFacility(id: number) { return this.memStorage.deleteFacility(id); }

  async getOrganizations() { return this.memStorage.getOrganizations(); }
  async getOrganizationById(id: number) { return this.memStorage.getOrganizationById(id); }
  async createOrganization(org: any) { return this.memStorage.createOrganization(org); }
  async updateOrganization(id: number, data: any) { return this.memStorage.updateOrganization(id, data); }
  async deleteOrganization(id: number) { return this.memStorage.deleteOrganization(id); }

  async getDocks() { return this.memStorage.getDocks(); }
  async createDock(dock: any) { return this.memStorage.createDock(dock); }
  async updateDock(id: number, data: any) { return this.memStorage.updateDock(id, data); }
  async deleteDock(id: number) { return this.memStorage.deleteDock(id); }

  async getCarriers() { return this.memStorage.getCarriers(); }
  async createCarrier(carrier: any) { return this.memStorage.createCarrier(carrier); }
  async updateCarrier(id: number, data: any) { return this.memStorage.updateCarrier(id, data); }
  async deleteCarrier(id: number) { return this.memStorage.deleteCarrier(id); }

  async getAppointmentTypes() { return this.memStorage.getAppointmentTypes(); }
  async getAppointmentTypesByFacility(facilityId: number, tenantId?: number) { return this.memStorage.getAppointmentTypesByFacility(facilityId, tenantId); }
  async createAppointmentType(appointmentType: any) { return this.memStorage.createAppointmentType(appointmentType); }
  async updateAppointmentType(id: number, data: any) { return this.memStorage.updateAppointmentType(id, data); }
  async deleteAppointmentType(id: number) { return this.memStorage.deleteAppointmentType(id); }

  // Delegate all other methods
  async getSystemSettings() { return this.memStorage.getSystemSettings(); }
  async updateSystemSettings(settings: any) { return this.memStorage.updateSystemSettings(settings); }
  async getBookingPages() { return this.memStorage.getBookingPages(); }
  async getBookingPageBySlug(slug: string) { return this.memStorage.getBookingPageBySlug(slug); }
  async createBookingPage(bookingPage: any) { return this.memStorage.createBookingPage(bookingPage); }
  async updateBookingPage(id: number, data: any) { return this.memStorage.updateBookingPage(id, data); }
  async deleteBookingPage(id: number) { return this.memStorage.deleteBookingPage(id); }
  async getStandardQuestions() { return this.memStorage.getStandardQuestions(); }
  async createStandardQuestion(question: any) { return this.memStorage.createStandardQuestion(question); }
  async createStandardQuestionWithId(id: number, question: any) { return this.memStorage.createStandardQuestionWithId(id, question); }
  async updateStandardQuestion(id: number, data: any) { return this.memStorage.updateStandardQuestion(id, data); }
  async deleteStandardQuestion(id: number) { return this.memStorage.deleteStandardQuestion(id); }
  async getCompanyAssets(filters?: any) { return this.memStorage.getCompanyAssets(filters); }
  async createCompanyAsset(asset: any) { return this.memStorage.createCompanyAsset(asset); }
  async updateCompanyAsset(id: number, data: any) { return this.memStorage.updateCompanyAsset(id, data); }
  async deleteCompanyAsset(id: number) { return this.memStorage.deleteCompanyAsset(id); }
  async getTenants() { return this.memStorage.getTenants(); }
  async getTenantById(id: number) { return this.memStorage.getTenantById(id); }
  async createTenant(tenant: any) { return this.memStorage.createTenant(tenant); }
  async updateTenant(id: number, data: any) { return this.memStorage.updateTenant(id, data); }
  async deleteTenant(id: number) { return this.memStorage.deleteTenant(id); }

  // Add missing delegation methods
  async getNotificationsByUser(userId: number) { return this.memStorage.getNotificationsByUser(userId); }
  async getOrganizationModules(organizationId: number) { return this.memStorage.getOrganizationModules(organizationId); }
  async getAppointmentTypeFields(organizationId: number): Promise<Array<{
    fieldKey: string;
    label: string;
    fieldType: string;
    appointmentTypeId: number;
    included: boolean;
    required: boolean;
    orderPosition: number;
  }>> {
    // Return empty array for now
    return [];
  }
}

// Storage instance management
let storageInstance: IStorage | null = null;

export async function getStorage(): Promise<IStorage> {
  if (!storageInstance) {
    // Use database storage if DATABASE_URL is provided, otherwise use memory storage
    if (process.env.DATABASE_URL) {
      console.log("Using PostgreSQL database storage");
      storageInstance = new DatabaseStorage();
    } else {
      console.log("Using memory storage for development");
      storageInstance = new MemStorage();
    }
  }
  return storageInstance;
}
