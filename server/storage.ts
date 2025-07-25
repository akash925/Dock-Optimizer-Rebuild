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
  OrganizationDefaultHours, InsertOrganizationDefaultHours,
  OrganizationHoliday, InsertOrganizationHoliday,
  ScheduleStatus, DockStatus, HolidayScope, TimeInterval, AssetCategory,
  DefaultHours,
  users, docks, schedules, carriers, notifications, facilities, holidays, appointmentSettings,
  appointmentTypes, dailyAvailability, customQuestions, standardQuestions, bookingPages, assets, companyAssets,
  tenants, roles, organizationUsers, organizationModules, organizationFacilities, userPreferences,
  organizationDefaultHours, organizationHolidays, bolDocuments,

// Extended interface for storage operations to fix TS2339 errors
interface ExtendedInsertAppointmentSettings extends InsertAppointmentSettings {
  maxConcurrentInbound?: number;
  maxConcurrentOutbound?: number;
  shareAvailabilityInfo?: boolean;
  sunday?: boolean; monday?: boolean; tuesday?: boolean; wednesday?: boolean;
  thursday?: boolean; friday?: boolean; saturday?: boolean;
  sundayStartTime?: string; sundayEndTime?: string;
  mondayStartTime?: string; mondayEndTime?: string;
  tuesdayStartTime?: string; tuesdayEndTime?: string;
  wednesdayStartTime?: string; wednesdayEndTime?: string;
  thursdayStartTime?: string; thursdayEndTime?: string;
  fridayStartTime?: string; fridayEndTime?: string;
  saturdayStartTime?: string; saturdayEndTime?: string;
  sundayBreakStartTime?: string; sundayBreakEndTime?: string;
  mondayBreakStartTime?: string; mondayBreakEndTime?: string;
  tuesdayBreakStartTime?: string; tuesdayBreakEndTime?: string;
  wednesdayBreakStartTime?: string; wednesdayBreakEndTime?: string;
  thursdayBreakStartTime?: string; thursdayBreakEndTime?: string;
  fridayBreakStartTime?: string; fridayBreakEndTime?: string;
  saturdayBreakStartTime?: string; saturdayBreakEndTime?: string;
  sundayMaxAppointments?: number; mondayMaxAppointments?: number;
  tuesdayMaxAppointments?: number; wednesdayMaxAppointments?: number;
  thursdayMaxAppointments?: number; fridayMaxAppointments?: number;
  saturdayMaxAppointments?: number;
  defaultBufferTime?: number; defaultGracePeriod?: number;
  defaultEmailReminderTime?: number;
  allowAppointmentsThroughBreaks?: boolean;
  allowAppointmentsPastBusinessHours?: boolean;
}
  BolDocument, InsertBolDocument,
  OcrJob, InsertOcrJob, ocrJobs,
  PasswordResetToken, InsertPasswordResetToken, passwordResetTokens
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPg from "connect-pg-simple";
import { eq, and, gte, lte, or, ilike, SQL, sql, inArray } from "drizzle-orm";
import { db, pool, safeQuery } from "./db";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { getRedis } from './src/utils/redis';
import { logger } from "./utils/logger";
import { emailService } from './services/email';
import crypto from "crypto";
import connectRedis from 'connect-redis';

const redis = getRedis();

const scryptAsync = promisify(scrypt);
const MemoryStore = createMemoryStore(session);
const PostgresSessionStore = connectPg(session);
const RedisStore = connectRedis(session);

async function invalidateAvailabilityCache(schedule: { date: string, facilityId: number, appointmentTypeId: number, tenantId: number }) {
  if (!redis) return;
  const cacheKey = `availability:${schedule.date}:${schedule.facilityId}:${schedule.appointmentTypeId}:${schedule.tenantId}`;
  try {
    await redis.del(cacheKey);
    logger.debug(`[Cache] Invalidated availability cache for key: ${cacheKey}`);
  } catch (error) {
    console.error(`[Cache] Error invalidating availability cache for key ${cacheKey}:`, error);
  }
}

// Password hashing functions
export async function hashPassword(password: string) {
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
  updateUserPassword(id: number, currentPassword: string, newPassword: string): Promise<boolean>;
  getUsers(): Promise<User[]>;
  
  // User Preferences operations
  getUserPreferences(userId: number): Promise<UserPreferences | undefined>;
  createUserPreferences(preferences: InsertUserPreferences): Promise<UserPreferences>;
  updateUserPreferences(userId: number, preferences: Partial<UserPreferences>): Promise<UserPreferences>;
  
  // Dock operations
  getDock(id: number): Promise<Dock | undefined>;
  getDocks(): Promise<Dock[]>;
  getDocksByFacility(facilityId: number): Promise<Dock[]>;
  createDock(dock: InsertDock): Promise<Dock>;
  updateDock(id: number, dock: Partial<Dock>): Promise<Dock | undefined>;
  deleteDock(id: number): Promise<boolean>;

  // Schedule operations
  getSchedule(id: number): Promise<Schedule | undefined>;
  getSchedules(tenantId?: number): Promise<Schedule[]>;
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
  getAppointmentTypes(tenantId?: number): Promise<AppointmentType[]>;
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
  createStandardQuestionWithId(question: InsertStandardQuestion & { id: number }): Promise<StandardQuestion>;
  updateStandardQuestion(id: number, standardQuestion: Partial<StandardQuestion>): Promise<StandardQuestion | undefined>;
  deleteStandardQuestion(id: number): Promise<boolean>;
  saveStandardQuestionsForAppointmentType(appointmentTypeId: number, questions: Partial<StandardQuestion>[]): Promise<StandardQuestion[]>;
  
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
  getCompanyAssets(filters?: Record<string, any>): Promise<CompanyAsset[]>;
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
  getOrganizationDefaultHours(tenantId: number): Promise<DefaultHours[] | null>;
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
  
  // Organization holidays operations
  getOrganizationHolidays(tenantId: number): Promise<OrganizationHoliday[]>;
  createOrganizationHoliday(holiday: InsertOrganizationHoliday): Promise<OrganizationHoliday>;
  updateOrganizationHoliday(id: number, holiday: Partial<OrganizationHoliday>): Promise<OrganizationHoliday | undefined>;
  deleteOrganizationHoliday(id: number): Promise<boolean>;
  
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
  
  // BOL Document operations
  createBolDocument(bolDocument: InsertBolDocument): Promise<BolDocument>;
  getBolDocumentById(id: number): Promise<BolDocument | undefined>;
  getBolDocumentsByScheduleId(scheduleId: number): Promise<BolDocument[]>;
  deleteBolDocument(id: number): Promise<boolean>;
  
  // Session store
  sessionStore: any; // Type-safe session store
  
  // Organization holiday management
  getOrganizationHolidays(organizationId?: number): Promise<any[]>;
  createOrganizationHoliday(tenantId: number, holiday: InsertOrganizationHoliday): Promise<OrganizationHoliday>;
  updateOrganizationHoliday(id: number, holiday: Partial<OrganizationHoliday>): Promise<OrganizationHoliday | undefined>;
  deleteOrganizationHoliday(id: number): Promise<boolean>;
  
  // Organization default hours management
  getOrganizationDefaultHours(tenantId: number): Promise<DefaultHours[] | null>;
  updateOrganizationDefaultHours(tenantId: number, data: any): Promise<any>;
  
  // Organization info management
  getOrganization(tenantId: number): Promise<Tenant | undefined>;
  updateOrganization(tenantId: number, data: Partial<Tenant>): Promise<Tenant | undefined>;
  
  // OCR Jobs management
  createOcrJob(ocrJob: InsertOcrJob): Promise<OcrJob>;
  getOcrJob(id: number): Promise<OcrJob | undefined>;
  getOcrJobsByStatus(status: string): Promise<OcrJob[]>;
  updateOcrJob(id: number, ocrJob: Partial<OcrJob>): Promise<OcrJob | undefined>;
  
  // Additional missing methods for Asset Manager
  getUser(id: number): Promise<User | undefined>;
  getFacilityById(id: number, tenantId?: number): Promise<Facility | undefined>;
  getFacility(id: number, tenantId?: number): Promise<Facility | undefined>;
  
  // Password Reset Token methods
  createPasswordResetToken(userId: number): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | null>;
  markPasswordResetTokenAsUsed(tokenId: number): Promise<void>;
  cleanupExpiredPasswordResetTokens(): Promise<void>;
  getUserByEmail(email: string): Promise<User | null>;
  updateUserPasswordDirect(userId: number, hashedPassword: string): Promise<void>;
  updateUserEmail(userId: number, email: string): Promise<void>;
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
    // Set up session store with Redis fallback
    if (redis) {
      this.sessionStore = new RedisStore({
        client: redis,
        prefix: 'sess:',
        ttl: 86400, // 24 hours
      });
      console.log('[Session] Using Redis session store');
    } else {
      this.sessionStore = new MemoryStore({
        checkPeriod: 86400000, // 24 hours
      });
      console.warn('[Session] ⚠️  Using MemoryStore fallback - Redis not configured');
    }
    
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
  // Dock operations - removed delegations to use DatabaseStorage implementations
  async getDocks(tenantId?: number): Promise<Dock[]> {
    if (tenantId) {
      const facilityIds = Array.from(this.facilities.values())
        .filter(f => f.tenantId === tenantId)
        .map(f => f.id);
      return Array.from(this.docks.values()).filter(d => d.facilityId && facilityIds.includes(d.facilityId));
    }
    return Array.from(this.docks.values());
  }
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
  async getSchedules(tenantId?: number): Promise<Schedule[]> { 
    const allSchedules = Array.from(this.schedules.values());
    if (!tenantId) return allSchedules;
    // TODO: Add tenant filtering for MemStorage
    return allSchedules;
  }
  async getSchedulesByDock(dockId: number): Promise<Schedule[]> { return Array.from(this.schedules.values()).filter(s => s.dockId === dockId); }
  async getSchedulesByDateRange(startDate: Date, endDate: Date): Promise<Schedule[]> { return Array.from(this.schedules.values()).filter(s => new Date(s.startTime) >= startDate && new Date(s.endTime) <= endDate); }
  async searchSchedules(query: string): Promise<Schedule[]> { return []; }
  async getScheduleByConfirmationCode(code: string): Promise<Schedule | undefined> { return undefined; }
  async createSchedule(insertSchedule: InsertSchedule): Promise<Schedule> {
    const id = this.scheduleIdCounter++;
    const schedule: Schedule = { ...insertSchedule, id, tenantId: insertSchedule.tenantId ?? 1, createdAt: new Date(), lastModifiedAt: new Date(), createdBy: insertSchedule.createdBy ?? 1, lastModifiedBy: insertSchedule.createdBy, facilityId: insertSchedule.facilityId ?? null, dockId: insertSchedule.dockId ?? null, carrierId: insertSchedule.carrierId ?? null, appointmentTypeId: insertSchedule.appointmentTypeId ?? null, truckNumber: insertSchedule.truckNumber, trailerNumber: insertSchedule.trailerNumber ?? null, driverName: insertSchedule.driverName ?? null, driverPhone: insertSchedule.driverPhone ?? null, driverEmail: insertSchedule.driverEmail ?? null, customerName: insertSchedule.customerName ?? null, carrierName: insertSchedule.carrierName ?? null, mcNumber: insertSchedule.mcNumber ?? null, bolNumber: insertSchedule.bolNumber ?? null, poNumber: insertSchedule.poNumber ?? null, palletCount: insertSchedule.palletCount ?? null, weight: insertSchedule.weight ?? null, appointmentMode: insertSchedule.appointmentMode ?? 'trailer', notes: insertSchedule.notes ?? null, customFormData: insertSchedule.customFormData ?? null, creatorEmail: insertSchedule.creatorEmail ?? null, actualStartTime: insertSchedule.actualStartTime ? new Date(insertSchedule.actualStartTime) : null, actualEndTime: insertSchedule.actualEndTime ? new Date(insertSchedule.actualEndTime) : null, confirmationCode: insertSchedule.confirmationCode ?? null };
    this.schedules.set(id, schedule);
    
    // Send confirmation email
    try {
      if (schedule.driverEmail && schedule.tenantId) {
        const tenant = await this.getTenantById(schedule.tenantId);
        const emailTemplates = (tenant?.settings as any)?.emailTemplates || {};
        const confirmationTemplate = emailTemplates.confirmation || {};

        await emailService.sendAppointmentConfirmation(
          schedule.driverEmail,
          {
            confirmationCode: schedule.confirmationCode,
            facilityName: (await this.getFacility(schedule.facilityId!))?.name,
            appointmentDate: schedule.startTime,
            appointmentTime: schedule.startTime,
            customerName: schedule.customerName,
            timezone: tenant?.timezone || 'Etc/UTC',
            template: confirmationTemplate,
          }
        );
        logger.debug(`[Storage] Confirmation email sent for schedule ${schedule.id}`);
      }
    } catch (emailError) {
      console.error(`[Storage] Error sending confirmation email for schedule ${schedule.id}:`, emailError);
    }
    
    // 🔥 REAL-TIME: Emit appointment:created event after DB insert
    try {
      const { eventSystem } = await import('./services/enhanced-event-system');
      
      // Emit appointment:created event with id and tenantId
      eventSystem.emit('appointment:created', {
        schedule: { ...schedule, lastModifiedBy: schedule.createdBy } as EnhancedSchedule,
        tenantId: schedule.tenantId || 1
      });
      
      logger.debug(`[Storage] appointment:created event emitted for schedule ${schedule.id}`);
    } catch (eventError) {
      console.error('[Storage] Error emitting appointment:created event:', eventError);
      // Don't fail the schedule creation if event fails
    }
    
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
  // Carrier operations - removed delegations to use DatabaseStorage implementations
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
    const results = await db
      .select()
      .from(facilities)
      .innerJoin(organizationFacilities, eq(facilities.id, organizationFacilities.facilityId))
      .where(eq(organizationFacilities.organizationId, organizationId));
    
    return results.map((r: any) => r.facilities);
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
  async createAppointmentSettings(insertSettings: ExtendedInsertAppointmentSettings): Promise<AppointmentSettings> {
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
  async getAppointmentTypes(tenantId?: number): Promise<AppointmentType[]> {
    if (tenantId) {
      return Array.from(this.appointmentTypes.values()).filter(t => t.tenantId === tenantId);
    }
    return Array.from(this.appointmentTypes.values());
  }
  async getAppointmentTypesByFacility(facilityId: number): Promise<AppointmentType[]> { return Array.from(this.appointmentTypes.values()).filter(t => t.facilityId === facilityId); }
  async createAppointmentType(appointmentType: InsertAppointmentType): Promise<AppointmentType> {
    const id = this.appointmentTypeIdCounter++;
    const newAppointmentType: AppointmentType = { ...appointmentType, id, createdAt: new Date(), lastModifiedAt: new Date(), description: appointmentType.description ?? null, maxAppointmentsPerDay: appointmentType.maxAppointmentsPerDay ?? null, tenantId: appointmentType.tenantId ?? null, type: appointmentType.type as 'INBOUND' | 'OUTBOUND', timezone: appointmentType.timezone ?? 'America/New_York' };
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
    const newCustomQuestion: CustomQuestion = { ...customQuestion, id, createdAt: new Date(), lastModifiedAt: new Date(), placeholder: customQuestion.placeholder ?? null, options: customQuestion.options ?? null, defaultValue: customQuestion.defaultValue ?? null, appointmentTypeId: customQuestion.appointmentTypeId ?? null, type: customQuestion.type as any, isRequired: customQuestion.isRequired ?? false, applicableType: customQuestion.applicableType as any ?? 'both' };
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
    const standardQuestion: StandardQuestion = { ...insertStandardQuestion, id, createdAt: new Date(), fieldType: insertStandardQuestion.fieldType as any, included: insertStandardQuestion.included ?? true, required: insertStandardQuestion.required ?? false, orderPosition: insertStandardQuestion.orderPosition ?? 0 };
    this.standardQuestions.set(id, standardQuestion);
    return standardQuestion;
  }
  async createStandardQuestionWithId(question: InsertStandardQuestion & { id: number }): Promise<StandardQuestion> {
    const newQuestion: StandardQuestion = { ...question, createdAt: new Date(), fieldType: question.fieldType as any, included: question.included ?? true, required: question.required ?? false, orderPosition: question.orderPosition ?? 0 };
    this.standardQuestions.set(question.id, newQuestion);
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
  // Booking Page operations - removed delegations to use DatabaseStorage implementations
  async createBookingPage(insertBookingPage: InsertBookingPage): Promise<BookingPage> {
    const id = this.bookingPageIdCounter++;
    const bookingPage: BookingPage = { ...insertBookingPage, id, createdAt: new Date(), lastModifiedAt: new Date(), lastModifiedBy: insertBookingPage.createdBy, description: insertBookingPage.description ?? null, welcomeMessage: insertBookingPage.welcomeMessage ?? null, confirmationMessage: insertBookingPage.confirmationMessage ?? null, excludedAppointmentTypes: insertBookingPage.excludedAppointmentTypes ?? null, customLogo: insertBookingPage.customLogo ?? null, tenantId: insertBookingPage.tenantId ?? null, isActive: insertBookingPage.isActive ?? true, primaryColor: insertBookingPage.primaryColor ?? '#4CAF50', useOrganizationLogo: insertBookingPage.useOrganizationLogo ?? false };
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
  async getCompanyAssets(filters?: Record<string, any>): Promise<CompanyAsset[]> { 
    // Removed debug logging for production
    return Array.from(this.companyAssets.values()); 
  }
  async getFilteredCompanyAssets(filters: Record<string, any>): Promise<CompanyAsset[]> { return []; }
  async createCompanyAsset(companyAsset: InsertCompanyAsset): Promise<CompanyAsset> {
    const id = this.companyAssetIdCounter++;
    const newCompanyAsset: CompanyAsset = { ...companyAsset, id, createdAt: new Date(), updatedAt: new Date(), department: companyAsset.department ?? null, barcode: companyAsset.barcode ?? null, serialNumber: companyAsset.serialNumber ?? null, description: companyAsset.description ?? null, purchasePrice: companyAsset.purchasePrice ?? null, purchaseDate: companyAsset.purchaseDate ?? null, warrantyExpiration: companyAsset.warrantyExpiration ?? null, depreciation: companyAsset.depreciation ?? null, assetValue: companyAsset.assetValue ?? null, template: companyAsset.template ?? null, tags: companyAsset.tags ?? null, model: companyAsset.model ?? null, assetCondition: companyAsset.assetCondition ?? null, notes: companyAsset.notes ?? null, manufacturerPartNumber: companyAsset.manufacturerPartNumber ?? null, supplierName: companyAsset.supplierName ?? null, poNumber: companyAsset.poNumber ?? null, vendorInformation: companyAsset.vendorInformation ?? null, photoUrl: companyAsset.photoUrl ?? null, documentUrls: companyAsset.documentUrls ?? null, lastMaintenanceDate: companyAsset.lastMaintenanceDate ?? null, nextMaintenanceDate: companyAsset.nextMaintenanceDate ?? null, maintenanceSchedule: companyAsset.maintenanceSchedule ?? null, maintenanceContact: companyAsset.maintenanceContact ?? null, maintenanceNotes: companyAsset.maintenanceNotes ?? null, implementationDate: companyAsset.implementationDate ?? null, expectedLifetime: companyAsset.expectedLifetime ?? null, certificationDate: companyAsset.certificationDate ?? null, certificationExpiry: companyAsset.certificationExpiry ?? null, createdBy: companyAsset.createdBy ?? null, updatedBy: companyAsset.updatedBy ?? null, status: companyAsset.status as any ?? 'ACTIVE' };
    this.companyAssets.set(id, newCompanyAsset);
    return newCompanyAsset;
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

  async getUserPreferences(userId: number): Promise<UserPreferences | undefined> {
    return Array.from(this.userPreferences.values()).find(p => p.userId === userId);
  }

  async createUserPreferences(preferences: InsertUserPreferences): Promise<UserPreferences> {
    const id = this.userPreferencesIdCounter++;
    const newPreferences: UserPreferences = {
      id,
      userId: preferences.userId,
      organizationId: preferences.organizationId || 0,
      emailNotificationsEnabled: preferences.emailNotificationsEnabled ?? true,
      emailScheduleChanges: preferences.emailScheduleChanges ?? true,
      emailTruckArrivals: preferences.emailTruckArrivals ?? true,
      emailDockAssignments: preferences.emailDockAssignments ?? true,
      emailWeeklyReports: preferences.emailWeeklyReports ?? false,
      pushNotificationsEnabled: preferences.pushNotificationsEnabled ?? true,
      createdAt: new Date(),
      updatedAt: null
    };
    this.userPreferences.set(id, newPreferences);
    return newPreferences;
  }

  async updateUserPreferences(userId: number, preferencesUpdate: Partial<UserPreferences>): Promise<UserPreferences> {
    const existing = await this.getUserPreferences(userId);
    if (existing) {
      const updated = { 
        ...existing, 
        ...preferencesUpdate,
        updatedAt: new Date()
      };
      this.userPreferences.set(existing.id, updated);
      return updated;
    } else {
      return await this.createUserPreferences({ userId, organizationId: 1, ...preferencesUpdate });
    }
  }
}

// Database Storage Implementation using Drizzle ORM
export class DatabaseStorage implements IStorage {
  sessionStore: any;
  private memStorage: IStorage; // Add memStorage property

  constructor() {
    // Set up session store with Redis fallback to MemoryStore
    if (redis) {
      this.sessionStore = new RedisStore({
        client: redis,
        prefix: 'sess:',
        ttl: 86400, // 24 hours
      });
      console.log('[Session] Using Redis session store');
    } else {
      this.sessionStore = new MemoryStore({
        checkPeriod: 86400000, // 24 hours
      });
      console.warn('[Session] ⚠️  Using MemoryStore fallback - Redis not configured');
    }
    
    // Initialize memory storage as fallback for methods not yet implemented with database
    this.memStorage = new MemStorage() as any;
  }

  // Real database operations using Drizzle ORM
  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return user;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.getUserById(id);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Check if password is already a bcrypt hash (starts with $2b$ and proper length)
    const isBcryptHash = insertUser.password.startsWith('$2b$') && insertUser.password.length >= 60;
    
    console.log('[Storage] createUser password analysis:', {
      passwordLength: insertUser.password.length,
      startsWithBcrypt: insertUser.password.startsWith('$2b$'),
      isBcryptHash,
      passwordPrefix: insertUser.password.substring(0, 10) + '...'
    });
    
    // Only hash if it's not already a bcrypt hash
    const finalPassword = isBcryptHash ? insertUser.password : await hashPassword(insertUser.password);
    
    console.log('[Storage] Final password to store:', {
      length: finalPassword.length,
      startsWithBcrypt: finalPassword.startsWith('$2b$'),
      prefix: finalPassword.substring(0, 10) + '...'
    });
    
    const [newUser] = await db
      .insert(users)
      .values({ ...insertUser, password: finalPassword })
      .returning();
    return newUser;
  }

  async updateUser(id: number, userUpdate: Partial<User>): Promise<User | undefined> {
    if (userUpdate.password) {
      userUpdate.password = await hashPassword(userUpdate.password);
    }
    const [updatedUser] = await db
      .update(users)
      .set(userUpdate)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async updateUserModules(id: number, modules: string[]): Promise<boolean> {
    const result = await db
      .update(users)
      .set({ modules: JSON.stringify(modules) } as any)
      .where(eq(users.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Schedule operations with real database queries
  async getSchedules(tenantId?: number): Promise<Schedule[]> {
    // Removed debug logging for production
    
    if (!tenantId) {
      // No tenant ID provided, returning all schedules
      return await db.select().from(schedules);
    }

    // Filter schedules by tenant through appointment types only (stricter isolation)
    const result = await db.execute(sql`
      SELECT DISTINCT s.*
      FROM schedules s
      INNER JOIN appointment_types at ON s.appointment_type_id = at.id
      WHERE at.tenant_id = ${tenantId}
      ORDER BY s.id DESC
    `);
    
    logger.debug(`[DatabaseStorage] getSchedules tenant-filtered result count: ${result.rows.length}`);
    
    // Transform snake_case fields to camelCase for frontend compatibility
    const transformedSchedules = result.rows.map((row: any) => ({
      ...row,
      startTime: row.start_time,
      endTime: row.end_time,
      dockId: row.dock_id,
      carrierId: row.carrier_id,
      appointmentTypeId: row.appointment_type_id,
      truckNumber: row.truck_number,
      trailerNumber: row.trailer_number,
      driverName: row.driver_name,
      driverPhone: row.driver_phone,
      driverEmail: row.driver_email,
      customerName: row.customer_name,
      carrierName: row.carrier_name,
      mcNumber: row.mc_number,
      bolNumber: row.bol_number,
      poNumber: row.po_number,
      palletCount: row.pallet_count,
      appointmentMode: row.appointment_mode,
      actualStartTime: row.actual_start_time,
      actualEndTime: row.actual_end_time,
      customFormData: row.custom_form_data,
      creatorEmail: row.creator_email,
      createdBy: row.created_by,
      createdAt: row.created_at,
      lastModifiedAt: row.last_modified_at,
      lastModifiedBy: row.last_modified_by,
      confirmationCode: row.confirmation_code,
      facilityId: row.facility_id
    }));
    
    return transformedSchedules as Schedule[];
  }

  async getSchedulesByDateRange(startDate: Date, endDate: Date): Promise<Schedule[]> {
    return await db
      .select()
      .from(schedules)
      .where(and(gte(schedules.startTime, startDate), lte(schedules.endTime, endDate)));
  }

  async createSchedule(insertSchedule: InsertSchedule): Promise<Schedule> {
    if (insertSchedule.appointmentTypeId && insertSchedule.startTime) {
      const appointmentType = await db.query.appointmentTypes.findFirst({
        where: eq(appointmentTypes.id, insertSchedule.appointmentTypeId),
      });
      if (appointmentType) {
        const duration = appointmentType.duration || 60;
        const startTime = new Date(insertSchedule.startTime);
        insertSchedule.endTime = new Date(startTime.getTime() + duration * 60000);
      }
    }

    const [newSchedule] = await db.insert(schedules).values(insertSchedule).returning();
    
    // Invalidate cache
    if (newSchedule) {
      const scheduleDate = new Date(newSchedule.startTime).toISOString().split('T')[0];
      invalidateAvailabilityCache({
        date: scheduleDate,
        facilityId: newSchedule.facilityId!,
        appointmentTypeId: newSchedule.appointmentTypeId!,
        tenantId: newSchedule.tenantId!,
      });
    }
    
    // Send confirmation email
    try {
      if (newSchedule.driverEmail && newSchedule.tenantId) {
        const tenant = await this.getTenantById(newSchedule.tenantId);
        const emailTemplates = (tenant?.settings as any)?.emailTemplates || {};
        const confirmationTemplate = emailTemplates.confirmation || {};

        await emailService.sendAppointmentConfirmation(
          newSchedule.driverEmail,
          {
            confirmationCode: newSchedule.confirmationCode,
            facilityName: (await this.getFacility(newSchedule.facilityId!))?.name,
            appointmentDate: newSchedule.startTime,
            appointmentTime: newSchedule.startTime,
            customerName: newSchedule.customerName,
            timezone: tenant?.timezone || 'Etc/UTC',
            template: confirmationTemplate,
          }
        );
        logger.debug(`[Storage] Confirmation email sent for schedule ${newSchedule.id}`);
      }
    } catch (emailError) {
      console.error(`[Storage] Error sending confirmation email for schedule ${newSchedule.id}:`, emailError);
    }
    
    // 🔥 REAL-TIME: Emit appointment:created event after DB insert
    try {
      const { eventSystem } = await import('./services/enhanced-event-system');
      
      // Emit appointment:created event with id and tenantId
      eventSystem.emit('appointment:created', {
        schedule: newSchedule as any, // Use 'any' to avoid type issues
        tenantId: (insertSchedule as any).tenantId || 1
      });
      
      logger.debug(`[Storage] appointment:created event emitted for schedule ${newSchedule.id}`);
    } catch (eventError) {
      console.error('[Storage] Error emitting appointment:created event:', eventError);
      // Don't fail the schedule creation if event fails
    }
    
    return newSchedule;
  }

  async updateSchedule(id: number, scheduleUpdate: Partial<Schedule>): Promise<Schedule | undefined> {
    const [updatedSchedule] = await db
      .update(schedules)
      .set(scheduleUpdate)
      .where(eq(schedules.id, id))
      .returning();

    // Invalidate cache
    if (updatedSchedule) {
      const scheduleDate = new Date(updatedSchedule.startTime).toISOString().split('T')[0];
      invalidateAvailabilityCache({
        date: scheduleDate,
        facilityId: updatedSchedule.facilityId!,
        appointmentTypeId: updatedSchedule.appointmentTypeId!,
        tenantId: (updatedSchedule as any).tenantId!,
      });
    }

    return updatedSchedule;
  }

  async deleteSchedule(id: number): Promise<boolean> {
    // To invalidate cache, we need to fetch the schedule first
    const scheduleToDelete = await this.getSchedule(id);

    const result = await db.delete(schedules).where(eq(schedules.id, id));

    // Invalidate cache if deletion was successful
    if (result.rowCount && result.rowCount > 0 && scheduleToDelete) {
      const scheduleDate = new Date(scheduleToDelete.startTime).toISOString().split('T')[0];
      invalidateAvailabilityCache({
        date: scheduleDate,
        facilityId: scheduleToDelete.facilityId!,
        appointmentTypeId: scheduleToDelete.appointmentTypeId!,
        tenantId: (scheduleToDelete as any).tenantId!,
      });
    }

    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Facility operations with real database queries
  async getFacilities(tenantId?: number): Promise<Facility[]> {
    if (tenantId) {
      // Use organization_facilities junction table for tenant isolation
      const results = await db
        .select({ facility: facilities })
        .from(facilities)
        .innerJoin(organizationFacilities, eq(facilities.id, organizationFacilities.facilityId))
        .where(eq(organizationFacilities.organizationId, tenantId));
      
      return results.map((r: any) => r.facility);
    }
    return await db.select().from(facilities);
  }

  async getFacilitiesByOrganizationId(organizationId: number): Promise<Facility[]> {
    const results = await db
      .select()
      .from(facilities)
      .innerJoin(organizationFacilities, eq(facilities.id, organizationFacilities.facilityId))
      .where(eq(organizationFacilities.organizationId, organizationId));
    
    return results.map((r: any) => r.facilities);
  }

  async createFacility(insertFacility: InsertFacility): Promise<Facility> {
    const [newFacility] = await db.insert(facilities).values(insertFacility).returning();
    return newFacility;
  }

  async updateFacility(id: number, facilityUpdate: Partial<Facility>): Promise<Facility | undefined> {
    const [updatedFacility] = await db
      .update(facilities)
      .set(facilityUpdate)
      .where(eq(facilities.id, id))
      .returning();
    return updatedFacility;
  }

  async deleteFacility(id: number): Promise<boolean> {
    const result = await db.delete(facilities).where(eq(facilities.id, id));
    return result.rowCount! > 0;
  }

  // Tenant/Organization operations with real database queries
  async getAllTenants(): Promise<Tenant[]> {
    return await db.select().from(tenants);
  }

  async getTenantById(id: number): Promise<Tenant | undefined> {
    const cacheKey = `tenant:${id}`;
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch (error) {
        console.warn(`[Storage] Redis cache read failed for ${cacheKey}:`, error);
      }
    }

    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);

    if (redis && tenant) {
      try {
        await redis.set(cacheKey, JSON.stringify(tenant), 'EX', 3600); // Cache for 1 hour
      } catch (error) {
        console.warn(`[Storage] Redis cache write failed for ${cacheKey}:`, error);
      }
    }
    return tenant;
  }

  async createTenant(insertTenant: InsertTenant): Promise<Tenant> {
    const [newTenant] = await db.insert(tenants).values(insertTenant).returning();
    if (redis) {
      try {
        await redis.del(`tenant:${newTenant.id}`);
      } catch (error) {
        console.warn(`[Storage] Redis cache invalidation failed for tenant:${newTenant.id}:`, error);
      }
    }
    return newTenant;
  }

  async updateTenant(id: number, tenantUpdate: Partial<Tenant>): Promise<Tenant | undefined> {
    const [updatedTenant] = await db
      .update(tenants)
      .set(tenantUpdate)
      .where(eq(tenants.id, id))
      .returning();
    
    if (redis && updatedTenant) {
      try {
        await redis.del(`tenant:${id}`);
      } catch (error) {
        console.warn(`[Storage] Redis cache invalidation failed for tenant:${id}:`, error);
      }
    }
    return updatedTenant;
  }

  async deleteTenant(id: number): Promise<boolean> {
    const result = await db.delete(tenants).where(eq(tenants.id, id));
    if (redis && (result.rowCount || 0) > 0) {
      try {
        await redis.del(`tenant:${id}`);
      } catch (error) {
        console.warn(`[Storage] Redis cache invalidation failed for tenant:${id}:`, error);
      }
    }
    return (result.rowCount || 0) > 0;
  }

  // Dock operations with real database queries
  async getDocks(tenantId?: number): Promise<Dock[]> {
    logger.debug('[DatabaseStorage] getDocks called');
    try {
      if (tenantId) {
        // If tenantId is provided, join with facilities to filter
        const dockList = await db
          .select({ dock: docks })
          .from(docks)
          .innerJoin(facilities, eq(docks.facilityId, facilities.id))
          .where(eq(facilities.tenantId, tenantId));
        logger.debug(`[DatabaseStorage] getDocks for tenant ${tenantId} result count: ${dockList.length}`);
        return dockList.map((item: any) => item.dock);
      }
      const dockList = await db.select().from(docks);
      logger.debug(`[DatabaseStorage] getDocks (unfiltered) result count: ${dockList.length}`);
      return dockList;
    } catch (error) {
      console.error('Error fetching docks:', error);
      return [];
    }
  }

  async getDock(id: number): Promise<Dock | undefined> {
    const [dock] = await db.select().from(docks).where(eq(docks.id, id)).limit(1);
    return dock;
  }

  async getDocksByFacility(facilityId: number): Promise<Dock[]> {
    return await db.select().from(docks).where(eq(docks.facilityId, facilityId));
  }

  async createDock(insertDock: InsertDock): Promise<Dock> {
    const [newDock] = await db.insert(docks).values(insertDock).returning();
    return newDock;
  }

  async updateDock(id: number, dockUpdate: Partial<Dock>): Promise<Dock | undefined> {
    const [updatedDock] = await db
      .update(docks)
      .set(dockUpdate)
      .where(eq(docks.id, id))
      .returning();
    return updatedDock;
  }

  async deleteDock(id: number): Promise<boolean> {
    const result = await db.delete(docks).where(eq(docks.id, id));
    return result.rowCount > 0;
  }

  // Add missing methods with real database queries
  async getNotificationsByUser(userId: number): Promise<Notification[]> {
    return await db.select().from(notifications).where(eq(notifications.userId, userId));
  }

  async getOrganizationModules(organizationId: number): Promise<OrganizationModule[]> {
    return await db.select().from(organizationModules).where(eq(organizationModules.organizationId, organizationId));
  }

  async getAppointmentTypeFields(organizationId: number): Promise<Array<{
    fieldKey: string;
    label: string;
    fieldType: string;
    appointmentTypeId: number;
    included: boolean;
    required: boolean;
    orderPosition: number;
  }>> {
    // Return empty array for now - this would need proper implementation based on your schema
    return [];
  }

  // Carrier database operations
  async getCarriers(tenantId?: number): Promise<Carrier[]> {
    logger.debug('[DatabaseStorage] getCarriers called');
    if (tenantId) {
      // This is a more complex query as carriers are not directly linked to tenants.
      // We need to find carriers associated with schedules that belong to a tenant.
      const tenantCarriers = await db.selectDistinct({ carrier: carriers })
        .from(carriers)
        .innerJoin(schedules, eq(carriers.id, schedules.carrierId))
        .innerJoin(appointmentTypes, eq(schedules.appointmentTypeId, appointmentTypes.id))
        .where(eq(appointmentTypes.tenantId, tenantId));
      return tenantCarriers.map((item: any) => item.carrier);
    }
    const result = await db.select().from(carriers);
    logger.debug(`[DatabaseStorage] getCarriers result count: ${result.length}`);
    return result;
  }

  async getCarrier(id: number): Promise<Carrier | undefined> {
    logger.debug(`[DatabaseStorage] getCarrier called with id: ${id}`);
    const result = await db.select().from(carriers).where(eq(carriers.id, id));
    return result[0];
  }

  async createCarrier(insertCarrier: InsertCarrier): Promise<Carrier> {
    logger.debug('[DatabaseStorage] createCarrier called');
    const result = await db.insert(carriers).values(insertCarrier).returning();
    return result[0];
  }

  async updateCarrier(id: number, data: any): Promise<Carrier | undefined> {
    logger.debug('[DatabaseStorage] updateCarrier called with id:', { id });
    const result = await db.update(carriers).set(data).where(eq(carriers.id, id)).returning();
    return result[0];
  }

  async getAppointmentTypes(tenantId?: number): Promise<AppointmentType[]> {
    if (tenantId) {
      return db.select().from(appointmentTypes).where(eq(appointmentTypes.tenantId, tenantId));
    }
    return await db.select().from(appointmentTypes);
  }
  
  async getAppointmentTypesByFacility(facilityId: number, tenantId?: number): Promise<AppointmentType[]> {
    let query = db.select().from(appointmentTypes).where(eq(appointmentTypes.facilityId, facilityId));
    
    if (tenantId) {
      query = query.where(and(eq(appointmentTypes.facilityId, facilityId), eq(appointmentTypes.tenantId, tenantId)));
    }
    
    return await query;
  }
  
  async createAppointmentType(appointmentType: InsertAppointmentType): Promise<AppointmentType> {
    try {
      logger.debug('[DatabaseStorage] createAppointmentType called with:', { appointmentType });
      const [newAppointmentType] = await db.insert(appointmentTypes).values(appointmentType).returning();
      logger.debug('[DatabaseStorage] createAppointmentType created:', { newAppointmentType });
      return newAppointmentType;
    } catch (error) {
      console.error('Error creating appointment type:', error);
      throw error;
    }
  }
  
  async updateAppointmentType(id: number, data: Partial<AppointmentType>): Promise<AppointmentType | undefined> {
    try {
      logger.debug('[DatabaseStorage] updateAppointmentType called with id:', { id, data });
      const [updatedAppointmentType] = await db
        .update(appointmentTypes)
        .set({ ...data, lastModifiedAt: new Date() })
        .where(eq(appointmentTypes.id, id))
        .returning();
      logger.debug('[DatabaseStorage] updateAppointmentType result:', { updatedAppointmentType });
      return updatedAppointmentType;
    } catch (error) {
      console.error('Error updating appointment type:', error);
      throw error;
    }
  }
  
  async deleteAppointmentType(id: number): Promise<boolean> {
    try {
      const result = await db.delete(appointmentTypes).where(eq(appointmentTypes.id, id));
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting appointment type:', error);
      return false;
    }
  }

  async getSystemSettings() { return this.memStorage.getSystemSettings(); }
  async updateSystemSettings(settings: any) { return this.memStorage.updateSystemSettings(settings); }
  async getBookingPages(): Promise<BookingPage[]> {
    logger.debug('[DatabaseStorage] getBookingPages called');
    try {
      const pages = await db.select().from(bookingPages);
      logger.debug('[DatabaseStorage] getBookingPages result count:', { count: pages.length });
      return pages;
    } catch (error) {
      console.error('Error fetching booking pages:', error);
      return [];
    }
  }

  async getBookingPageBySlug(slug: string): Promise<BookingPage | undefined> {
    logger.debug('[DatabaseStorage] getBookingPageBySlug called with slug:', { slug });
    try {
      const [page] = await db.select().from(bookingPages).where(eq(bookingPages.slug, slug)).limit(1);
      logger.debug('[DatabaseStorage] getBookingPageBySlug result:', { page: page ? 'found' : 'not found' });
      return page;
    } catch (error) {
      console.error('Error fetching booking page by slug:', error);
      return undefined;
    }
  }

  async getBookingPage(id: number): Promise<BookingPage | undefined> {
    logger.debug('[DatabaseStorage] getBookingPage called with id:', { id });
    try {
      const [page] = await db.select().from(bookingPages).where(eq(bookingPages.id, id)).limit(1);
      logger.debug('[DatabaseStorage] getBookingPage result:', { page: page ? 'found' : 'not found' });
      return page;
    } catch (error) {
      console.error('Error fetching booking page by id:', error);
      return undefined;
    }
  }

  async createBookingPage(insertBookingPage: InsertBookingPage): Promise<BookingPage> {
    logger.debug('[DatabaseStorage] createBookingPage called');
    const result = await db.insert(bookingPages).values(insertBookingPage).returning();
    return result[0];
  }

  async updateBookingPage(id: number, data: any): Promise<BookingPage | undefined> {
    logger.debug('[DatabaseStorage] updateBookingPage called with id:', { id });
    const result = await db.update(bookingPages).set(data).where(eq(bookingPages.id, id)).returning();
    return result[0];
  }

  async deleteBookingPage(id: number): Promise<boolean> {
    logger.debug('[DatabaseStorage] deleteBookingPage called with id:', { id });
    const result = await db.delete(bookingPages).where(eq(bookingPages.id, id));
    return result.rowCount > 0;
  }
  async getStandardQuestions() { return this.memStorage.getStandardQuestions(); }
  async createStandardQuestion(question: any) { return this.memStorage.createStandardQuestion(question); }
  async createStandardQuestionWithId(id: number, question: any) { return this.memStorage.createStandardQuestionWithId(id, question); }
  // updateStandardQuestion method moved to DatabaseStorage implementation
  async deleteStandardQuestion(id: number) { return this.memStorage.deleteStandardQuestion(id); }
  async getCompanyAssets(filters?: any): Promise<any[]> {
    try {
      logger.debug('[Storage] getCompanyAssets called with filters:', { filters: JSON.stringify(filters, null, 2) });
      
      let query = db.select().from(companyAssets);
      const conditions = [];
      
      // Apply tenant filtering - always required for security
      if (!filters?.tenantId) {
        console.error('[Storage] getCompanyAssets called without tenantId - this is a security violation');
        return [];
      }
      logger.debug(`[Storage] Filtering by tenantId: ${filters.tenantId}`);
      conditions.push(eq(companyAssets.tenantId, filters.tenantId));
      
      // Apply additional filters
      if (filters?.category) {
        conditions.push(eq(companyAssets.category, filters.category));
      }
      
      if (filters?.status) {
        conditions.push(eq(companyAssets.status, filters.status));
      }
      
      if (filters?.location) {
        conditions.push(ilike(companyAssets.location, `%${filters.location}%`));
      }
      
      if (filters?.q) {
        conditions.push(or(
          ilike(companyAssets.name, `%${filters.q}%`),
          ilike(companyAssets.description, `%${filters.q}%`),
          ilike(companyAssets.barcode, `%${filters.q}%`)
        ));
      }
      
      // Apply all conditions
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      
      logger.debug(`[Storage] Executing company assets query with ${conditions.length} conditions for tenant ${filters.tenantId}`);
      logger.debug(`[Storage] Generated SQL conditions: ${JSON.stringify(conditions)}`);
      
      // Test with raw SQL first to verify data exists
      const rawTestResult = await db.execute(sql`SELECT COUNT(*) as count FROM company_assets WHERE tenant_id = ${filters.tenantId}`);
      logger.debug(`[Storage] Raw SQL test - found ${rawTestResult.rows[0]?.count} assets for tenant ${filters.tenantId}`);
      
      const assets = await query;
      logger.debug(`[Storage] Drizzle query returned ${assets.length} company assets with filters: ${JSON.stringify(filters)}`);
      logger.debug(`[Storage] Sample asset data: ${JSON.stringify(assets.slice(0, 2))}`);
      return assets;
    } catch (error) {
      console.error('Error fetching company assets:', error);
      return [];
    }
  }
  
  async getFilteredCompanyAssets(filters: any): Promise<any[]> {
    logger.debug(`[DatabaseStorage] getFilteredCompanyAssets called with filters: ${JSON.stringify(filters)}`);
    const result = await this.getCompanyAssets(filters);
    logger.debug(`[DatabaseStorage] getFilteredCompanyAssets result count: ${result.length}`);
    return result;
  }

  async getCompanyAsset(id: number): Promise<any | undefined> {
    try {
      logger.debug(`[DatabaseStorage] getCompanyAsset called with id: ${id}`);
      const [asset] = await db.select().from(companyAssets).where(eq(companyAssets.id, id)).limit(1);
      logger.debug(`[DatabaseStorage] getCompanyAsset result: ${asset ? 'found' : 'not found'}`);
      return asset;
    } catch (error) {
      console.error('Error fetching company asset by id:', error);
      return undefined;
    }
  }

  async getFacilityById(id: number, tenantId?: number): Promise<Facility | undefined> {
    return this.getFacility(id, tenantId);
  }
  
  async createCompanyAsset(companyAsset: InsertCompanyAsset): Promise<CompanyAsset> {
    try {
      logger.debug(`[DatabaseStorage] createCompanyAsset called with: ${JSON.stringify(companyAsset)}`);
      const [newAsset] = await db.insert(companyAssets).values(companyAsset).returning();
      logger.debug(`[DatabaseStorage] createCompanyAsset created asset with id: ${newAsset.id}`);
      return newAsset;
    } catch (error) {
      console.error('Error creating company asset:', error);
      throw error;
    }
  }
  
  async updateCompanyAsset(id: number, companyAssetUpdate: UpdateCompanyAsset): Promise<CompanyAsset | undefined> {
    try {
      logger.debug(`[DatabaseStorage] updateCompanyAsset called with id: ${id}, data: ${JSON.stringify(companyAssetUpdate)}`);
      const [updatedAsset] = await db.update(companyAssets)
        .set({ ...companyAssetUpdate, updatedAt: new Date() })
        .where(eq(companyAssets.id, id))
        .returning();
      logger.debug(`[DatabaseStorage] updateCompanyAsset updated asset: ${updatedAsset ? 'success' : 'not found'}`);
      return updatedAsset;
    } catch (error) {
      console.error('Error updating company asset:', error);
      throw error;
    }
  }

  async findCompanyAssetByBarcode(barcode: string): Promise<CompanyAsset | undefined> {
    try {
      logger.debug(`[DatabaseStorage] findCompanyAssetByBarcode called with barcode: ${barcode}`);
      const [asset] = await db.select().from(companyAssets).where(eq(companyAssets.barcode, barcode)).limit(1);
      logger.debug(`[DatabaseStorage] findCompanyAssetByBarcode result: ${asset ? 'found' : 'not found'}`);
      return asset;
    } catch (error) {
      console.error('Error finding company asset by barcode:', error);
      return undefined;
    }
  }

  // Add missing interface methods - getUser is implemented with getUserById below
  // updateUserPassword is implemented below with proper database queries
  // Schedule methods - Implement database versions
  async getSchedule(id: number): Promise<Schedule | undefined> {
    try {
      const [schedule] = await db.select().from(schedules).where(eq(schedules.id, id)).limit(1);
      return schedule;
    } catch (error) {
      console.error('Error fetching schedule:', error);
      return undefined;
    }
  }
  

  
  async getSchedulesByDock(dockId: number): Promise<Schedule[]> {
    try {
      return await db.select().from(schedules).where(eq(schedules.dockId, dockId));
    } catch (error) {
      console.error('Error fetching schedules by dock:', error);
      return [];
    }
  }
  
  async searchSchedules(query: string): Promise<Schedule[]> {
    try {
      return await db.select().from(schedules)
        .where(or(
          ilike(schedules.driverName, `%${query}%`),
          ilike(schedules.customerName, `%${query}%`),
          ilike(schedules.confirmationCode, `%${query}%`)
        ));
    } catch (error) {
      console.error('Error searching schedules:', error);
      return [];
    }
  }
  async getScheduleByConfirmationCode(code: string): Promise<Schedule | undefined> {
    try {
      // Query the database for schedule with matching confirmation code
      const result = await safeQuery(async () => {
        return await db
          .select()
          .from(schedules)
          .where(eq(schedules.confirmationCode, code))
          .limit(1);
      });
      
      if (!result || result.length === 0) {
        return undefined;
      }
      
      return result[0];
    } catch (error) {
      console.error('Error fetching schedule by confirmation code:', error);
      return undefined;
    }
  }
  // Carrier operations implemented above in database section
  async getFacility(id: number, tenantId?: number): Promise<Facility | undefined> {
    try {
      if (tenantId) {
        // Use organization_facilities junction table for tenant isolation
        const results = await db
          .select({ facility: facilities })
          .from(facilities)
          .innerJoin(organizationFacilities, eq(facilities.id, organizationFacilities.facilityId))
          .where(and(
            eq(facilities.id, id),
            eq(organizationFacilities.organizationId, tenantId)
          ))
          .limit(1);
        
        return results.length > 0 ? results[0].facility : undefined;
      } else {
        // No tenant isolation - return facility directly
        const [facility] = await db.select().from(facilities).where(eq(facilities.id, id)).limit(1);
        return facility;
      }
    } catch (error) {
      console.error('Error fetching facility:', error);
      return undefined;
    }
  }
  async getOrganizationByFacilityId(facilityId: number): Promise<Tenant | undefined> {
    try {
      logger.debug(`[DatabaseStorage] getOrganizationByFacilityId called with facilityId: ${facilityId}`);
      
      // Query the organization_facilities junction table to find the organization for this facility
      const result = await db
        .select({
          organization: tenants
        })
        .from(organizationFacilities)
        .innerJoin(tenants, eq(organizationFacilities.organizationId, tenants.id))
        .where(eq(organizationFacilities.facilityId, facilityId))
        .limit(1);
      
      if (result.length > 0) {
        logger.debug(`[DatabaseStorage] Found organization ${result[0].organization.id} (${result[0].organization.name}) for facility ${facilityId}`);
        return result[0].organization;
      }
      
      // Fallback: Check if facility has tenantId directly
      const facility = await this.getFacility(facilityId);
      if (facility && facility.tenantId) {
        logger.debug(`[DatabaseStorage] Using facility.tenantId (${facility.tenantId}) as fallback for facility ${facilityId}`);
        const tenant = await this.getTenantById(facility.tenantId);
        return tenant;
      }
      
      logger.debug(`[DatabaseStorage] No organization found for facility ${facilityId}`);
      return undefined;
    } catch (error) {
      console.error('Error fetching organization by facility ID:', error);
      return undefined;
    }
  }
  async getOrganizationByAppointmentTypeId(appointmentTypeId: number): Promise<Tenant | undefined> {
    try {
      logger.debug(`[DatabaseStorage] getOrganizationByAppointmentTypeId called with appointmentTypeId: ${appointmentTypeId}`);
      
      // First get the appointment type to find its tenantId
      const appointmentType = await this.getAppointmentType(appointmentTypeId);
      if (!appointmentType) {
        logger.debug(`[DatabaseStorage] Appointment type ${appointmentTypeId} not found`);
        return undefined;
      }
      
      if (appointmentType.tenantId) {
        logger.debug(`[DatabaseStorage] Found tenantId ${appointmentType.tenantId} for appointment type ${appointmentTypeId}`);
        const tenant = await this.getTenantById(appointmentType.tenantId);
        return tenant;
      }
      
      // Fallback: Use the facilityId to find the organization
      if (appointmentType.facilityId) {
        logger.debug(`[DatabaseStorage] Using facilityId ${appointmentType.facilityId} as fallback for appointment type ${appointmentTypeId}`);
        return await this.getOrganizationByFacilityId(appointmentType.facilityId);
      }
      
      logger.debug(`[DatabaseStorage] No organization found for appointment type ${appointmentTypeId}`);
      return undefined;
    } catch (error) {
      console.error('Error fetching organization by appointment type ID:', error);
      return undefined;
    }
  }
  async getFacilityTenantId(facilityId: number): Promise<number> {
    try {
      logger.debug(`[DatabaseStorage] getFacilityTenantId called with facilityId: ${facilityId}`);
      
      // First try to get the organization via the organization_facilities junction table
      const organization = await this.getOrganizationByFacilityId(facilityId);
      if (organization) {
        logger.debug(`[DatabaseStorage] Found tenant ID ${organization.id} for facility ${facilityId} via organization lookup`);
        return organization.id;
      }
      
      // Fallback: Check if facility has tenantId directly
      const facility = await this.getFacility(facilityId);
      if (facility && facility.tenantId) {
        logger.debug(`[DatabaseStorage] Found tenant ID ${facility.tenantId} for facility ${facilityId} via facility.tenantId`);
        return facility.tenantId;
      }
      
      logger.debug(`[DatabaseStorage] No tenant ID found for facility ${facilityId}, returning default 1`);
      return 1; // Default fallback
    } catch (error) {
      console.error('Error fetching facility tenant ID:', error);
      return 1; // Default fallback
    }
  }

  // Organization settings methods  
  async getOrganization(tenantId: number): Promise<Tenant | undefined> {
    try {
      const [org] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
      return org;
    } catch (error) {
      console.error('Error fetching organization:', error);
      return undefined;
    }
  }

  async updateOrganization(tenantId: number, data: Partial<Tenant>): Promise<Tenant | undefined> {
    try {
      const [updated] = await db.update(tenants)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(tenants.id, tenantId))
        .returning();
      return updated;
    } catch (error) {
      console.error('Error updating organization:', error);
      return undefined;
    }
  }

  async getOrganizationDefaultHours(tenantId: number): Promise<DefaultHours[] | null> {
    try {
      const hours = await db.select({
        id: organizationDefaultHours.id,
        tenantId: organizationDefaultHours.tenantId,
        dayOfWeek: organizationDefaultHours.dayOfWeek,
        isOpen: organizationDefaultHours.isOpen,
        openTime: organizationDefaultHours.openTime,
        closeTime: organizationDefaultHours.closeTime,
        breakStart: organizationDefaultHours.breakStart,
        breakEnd: organizationDefaultHours.breakEnd,
        createdAt: organizationDefaultHours.createdAt,
        updatedAt: organizationDefaultHours.updatedAt,
      }).from(organizationDefaultHours).where(eq(organizationDefaultHours.tenantId, tenantId)).orderBy(organizationDefaultHours.dayOfWeek);
      return hours as DefaultHours[];
    } catch (error) {
      // Gracefully handle missing table - this is expected in some deployments
      if (error.code === '42P01') { // Table does not exist
        logger.debug(`[DatabaseStorage] organization_default_hours table does not exist - using defaults for tenant ${tenantId}`);
        return []; // Return empty array to trigger default hours logic
      }
      console.error('Error fetching organization default hours:', error);
      return [];
    }
  }

  async updateOrganizationDefaultHours(tenantId: number, data: any): Promise<any> {
    try {
      // Check if record exists for this day
      const [existing] = await db.select({
        id: organizationDefaultHours.id,
        tenantId: organizationDefaultHours.tenantId,
        dayOfWeek: organizationDefaultHours.dayOfWeek,
        isOpen: organizationDefaultHours.isOpen,
        openTime: organizationDefaultHours.openTime,
        closeTime: organizationDefaultHours.closeTime,
        breakStart: organizationDefaultHours.breakStart,
        breakEnd: organizationDefaultHours.breakEnd,
        updatedAt: organizationDefaultHours.updatedAt,
      }).from(organizationDefaultHours).where(and(
        eq(organizationDefaultHours.tenantId, tenantId),
        eq(organizationDefaultHours.dayOfWeek, data.dayOfWeek)
      )).limit(1);

      if (existing) {
        // Update existing record
        const [updated] = await db.update(organizationDefaultHours)
          .set({
            isOpen: data.isOpen,
            openTime: data.openTime,
            closeTime: data.closeTime,
            breakStart: data.breakStart,
            breakEnd: data.breakEnd,
            updatedAt: new Date()
          })
          .where(and(
            eq(organizationDefaultHours.tenantId, tenantId),
            eq(organizationDefaultHours.dayOfWeek, data.dayOfWeek)
          ))
          .returning();
        return updated;
      } else {
        // Create new record
        const [created] = await db.insert(organizationDefaultHours)
          .values({
            tenantId,
            dayOfWeek: data.dayOfWeek,
            isOpen: data.isOpen,
            openTime: data.openTime,
            closeTime: data.closeTime,
            breakStart: data.breakStart,
            breakEnd: data.breakEnd,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();
        return created;
      }
    } catch (error) {
      console.error('Error updating organization default hours:', error);
      return null;
    }
  }

  async getOrganizationHolidays(tenantId?: number): Promise<any[]> {
    try {
      let query = db.select({
        id: organizationHolidays.id,
        tenantId: organizationHolidays.tenantId,
        name: organizationHolidays.name,
        date: organizationHolidays.date,
        isRecurring: organizationHolidays.isRecurring,
        createdAt: organizationHolidays.createdAt,
        updatedAt: organizationHolidays.updatedAt
      }).from(organizationHolidays);
      
      // If tenantId is provided, filter by organization, otherwise return all (super-admin view)
      if (tenantId !== undefined) {
        query = query.where(eq(organizationHolidays.tenantId, tenantId));
      }
      
      const holidays = await query.orderBy(organizationHolidays.date);
      return holidays;
    } catch (error) {
      // Gracefully handle missing holiday table - this is expected in some deployments
      if ((error as any).code === '42P01') { // Table does not exist
        logger.debug(`[DatabaseStorage] organization_holidays table does not exist - returning empty array for tenant ${tenantId}`);
        return []; // Return empty array to prevent crashes
      }
      console.error('Error fetching organization holidays:', error);
      return [];
    }
  }

  async createOrganizationHoliday(data: any): Promise<any> {
    try {
      const [created] = await db.insert(organizationHolidays)
        .values({
          tenantId: data.tenantId,
          name: data.name,
          date: data.date,
          isRecurring: data.isRecurring,
          description: data.description,
          createdAt: new Date()
        })
        .returning();
      return created;
    } catch (error) {
      console.error('Error creating organization holiday:', error);
      return null;
    }
  }

  async updateOrganizationHoliday(holidayId: number, data: any): Promise<any> {
    try {
      const [updated] = await db.update(organizationHolidays)
        .set({
          name: data.name,
          date: data.date,
          isRecurring: data.isRecurring,
          description: data.description,
          updatedAt: new Date()
        })
        .where(eq(organizationHolidays.id, holidayId))
        .returning();
      return updated;
    } catch (error) {
      console.error('Error updating organization holiday:', error);
      return null;
    }
  }

  async deleteOrganizationHoliday(holidayId: number): Promise<boolean> {
    try {
      const result = await db.delete(organizationHolidays)
        .where(eq(organizationHolidays.id, holidayId));
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting organization holiday:', error);
      return false;
    }
  }

  async getNotification(id: number) { return this.memStorage.getNotification(id); }
  async createNotification(notification: any) { return this.memStorage.createNotification(notification); }
  async markNotificationAsRead(id: number) { return this.memStorage.markNotificationAsRead(id); }
  async getAppointmentSettings(facilityId: number) { return this.memStorage.getAppointmentSettings(facilityId); }
  async createAppointmentSettings(settings: any) { return this.memStorage.createAppointmentSettings(settings); }
  async updateAppointmentSettings(facilityId: number, settings: any) { return this.memStorage.updateAppointmentSettings(facilityId, settings); }
  async getAppointmentType(id: number): Promise<AppointmentType | undefined> {
    try {
      const result = await db.select().from(appointmentTypes).where(eq(appointmentTypes.id, id));
      return result[0] || undefined;
    } catch (error) {
      console.error('Error fetching appointment type:', error);
      return undefined;
    }
  }
  async getDailyAvailability(id: number) { return this.memStorage.getDailyAvailability(id); }
  async getDailyAvailabilityByAppointmentType(appointmentTypeId: number) { return this.memStorage.getDailyAvailabilityByAppointmentType(appointmentTypeId); }
  async createDailyAvailability(dailyAvailability: any) { return this.memStorage.createDailyAvailability(dailyAvailability); }
  async updateDailyAvailability(id: number, dailyAvailability: any) { return this.memStorage.updateDailyAvailability(id, dailyAvailability); }
  async deleteDailyAvailability(id: number) { return this.memStorage.deleteDailyAvailability(id); }
  async getCustomQuestion(id: number): Promise<CustomQuestion | undefined> {
    try {
      const [customQuestion] = await db.select().from(customQuestions).where(eq(customQuestions.id, id));
      return customQuestion;
    } catch (error) {
      console.error('Error fetching custom question:', error);
      return undefined;
    }
  }

  async getCustomQuestionsByAppointmentType(appointmentTypeId: number): Promise<CustomQuestion[]> {
    try {
      const questions = await db.select().from(customQuestions)
        .where(eq(customQuestions.appointmentTypeId, appointmentTypeId))
        .orderBy(customQuestions.order);
      
      // Map database field names back to frontend field names
      return questions.map((q: any) => ({
        id: q.id,
        label: q.label,
        type: q.type,

        // Map isRequired back to frontend (field is already correctly named in schema)
        isRequired: q.isRequired || false,

        placeholder: q.placeholder,
        options: q.options,
        defaultValue: q.defaultValue,
        order: q.order,
        appointmentTypeId: q.appointmentTypeId,
        applicableType: q.applicableType,
        createdAt: q.createdAt,
        lastModifiedAt: q.lastModifiedAt
      }));
    } catch (error) {
      console.error('Error fetching custom questions by appointment type:', error);
      return [];
    }
  }

  async createCustomQuestion(customQuestion: InsertCustomQuestion): Promise<CustomQuestion> {
    try {
      logger.debug('[DatabaseStorage] Creating custom question:', customQuestion);
      
      // Ensure proper field mapping for database insertion
      const dbData = {
        label: customQuestion.label || "Untitled Question",
        type: customQuestion.type || "text",
        isRequired: Boolean(customQuestion.isRequired || false), // Use the correct field name for schema
        placeholder: customQuestion.placeholder || null,
        options: customQuestion.options || null,
        defaultValue: customQuestion.defaultValue || null,
        order: customQuestion.order || 1,
        appointmentTypeId: customQuestion.appointmentTypeId,
        applicableType: customQuestion.applicableType || "both",
        createdAt: new Date(),
        lastModifiedAt: new Date()
      };
      
      logger.debug('[DatabaseStorage] Inserting with data:', dbData);
      
      const [newQuestion] = await db.insert(customQuestions).values(dbData).returning();
      
      logger.debug('[DatabaseStorage] Created question:', newQuestion);
      
      // Return the question with proper field mapping
      return {
        id: newQuestion.id,
        label: newQuestion.label,
        type: newQuestion.type,
        isRequired: newQuestion.isRequired || false,
        placeholder: newQuestion.placeholder,
        options: newQuestion.options,
        defaultValue: newQuestion.defaultValue,
        order: newQuestion.order,
        appointmentTypeId: newQuestion.appointmentTypeId,
        applicableType: newQuestion.applicableType,
        createdAt: newQuestion.createdAt,
        lastModifiedAt: newQuestion.lastModifiedAt,
      };
    } catch (error) {
      console.error('[DatabaseStorage] Error creating custom question:', error);
      throw error;
    }
  }

  async updateCustomQuestion(id: number, customQuestion: Partial<CustomQuestion>): Promise<CustomQuestion | undefined> {
    try {
      // Map frontend field names to database field names
      const dbData = {
        ...customQuestion,
        lastModifiedAt: new Date(),
      };
      
      // Handle isRequired field mapping if present
      if ('isRequired' in customQuestion) {
        (dbData as any).is_required = customQuestion.isRequired || false;
        delete (dbData as any).isRequired;
      }

      const [updated] = await db.update(customQuestions)
        .set(dbData)
        .where(eq(customQuestions.id, id))
        .returning();
      
      if (updated) {
        // Map database field names back to frontend field names
        return {
          id: updated.id,
          label: updated.label,
          type: updated.type,
          isRequired: updated.is_required || false,  // Map is_required back to isRequired for frontend
          placeholder: updated.placeholder,
          options: updated.options,
          defaultValue: updated.defaultValue,
          order: updated.order,
          appointmentTypeId: updated.appointmentTypeId,
          applicableType: updated.applicableType,
          createdAt: updated.createdAt,
          lastModifiedAt: updated.lastModifiedAt,
        };
      }
      
      return undefined;
    } catch (error) {
      console.error('Error updating custom question:', error);
      return undefined;
    }
  }

  async deleteCustomQuestion(id: number): Promise<boolean> {
    try {
      const result = await db.delete(customQuestions).where(eq(customQuestions.id, id));
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting custom question:', error);
      return false;
    }
  }
  async getStandardQuestion(id: number): Promise<StandardQuestion | undefined> { return this.memStorage.getStandardQuestion(id); }
  
  async getStandardQuestionsByAppointmentType(appointmentTypeId: number): Promise<StandardQuestion[]> {
    try {
      const questions = await db.select().from(standardQuestions)
        .where(eq(standardQuestions.appointmentTypeId, appointmentTypeId))
        .orderBy(standardQuestions.orderPosition, standardQuestions.id);
      
      return questions.map((q: any) => ({
        id: q.id,
        appointmentTypeId: q.appointmentTypeId,
        fieldKey: q.fieldKey,
        label: q.label,
        fieldType: q.fieldType,
        included: q.included,
        required: q.required,
        orderPosition: q.orderPosition,
        createdAt: q.createdAt
      }));
    } catch (error) {
      console.error('Error fetching standard questions by appointment type:', error);
      return [];
    }
  }
  // getBookingPage is implemented above in the real database section
  async getAsset(id: number) { return this.memStorage.getAsset(id); }
  async getAssets() { return this.memStorage.getAssets(); }
  async getAssetsByUser(userId: number) { return this.memStorage.getAssetsByUser(userId); }
  async createAsset(asset: any) { return this.memStorage.createAsset(asset); }
  async updateAsset(id: number, asset: any) { return this.memStorage.updateAsset(id, asset); }
  async deleteAsset(id: number) { return this.memStorage.deleteAsset(id); }
  // getCompanyAsset is implemented above in the real database section
  // getFilteredCompanyAssets is implemented above in the real database section
  async getTenantBySubdomain(subdomain: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.subdomain, subdomain));
    return tenant;
  }
  // Organization default hours are implemented above with proper database queries
  // Role methods implemented below with proper database queries
  async getRole(id: number): Promise<RoleRecord | undefined> {
    const [role] = await db.select().from(roles).where(eq(roles.id, id));
    return role;
  }
  
  async getRoleByName(name: string): Promise<RoleRecord | undefined> {
    const [role] = await db.select().from(roles).where(eq(roles.name, name));
    return role;
  }
  
  async getRoleById(id: number): Promise<RoleRecord | undefined> {
    return this.getRole(id);
  }
  
  async getRoles(): Promise<RoleRecord[]> {
    return await db.select().from(roles);
  }
  
  async createRole(role: InsertRoleRecord): Promise<RoleRecord> {
    const [createdRole] = await db.insert(roles).values(role).returning();
    return createdRole;
  }
  // getUsersByOrganizationId is implemented below with proper database queries
  // getOrganizationUsers and getOrganizationUsersWithRoles are implemented below with proper database queries
  // Organization user management methods with proper database implementations
  async getUserOrganizationRole(userId: number, organizationId: number): Promise<OrganizationUser | undefined> {
    const [orgUser] = await db.select().from(organizationUsers)
      .where(and(eq(organizationUsers.userId, userId), eq(organizationUsers.organizationId, organizationId)));
    return orgUser;
  }
  
  async addUserToOrganization(orgUser: InsertOrganizationUser): Promise<OrganizationUser> {
    const [newOrgUser] = await db.insert(organizationUsers).values(orgUser).returning();
    return newOrgUser;
  }
  
  async addUserToOrganizationWithRole(userId: number, organizationId: number, roleId: number): Promise<OrganizationUser> {
    const [newOrgUser] = await db.insert(organizationUsers)
      .values({ userId, organizationId, roleId })
      .returning();
    return newOrgUser;
  }
  
  async removeUserFromOrganization(userId: number, organizationId: number): Promise<boolean> {
    const result = await db.delete(organizationUsers)
      .where(and(eq(organizationUsers.userId, userId), eq(organizationUsers.organizationId, organizationId)));
    return result.rowCount > 0;
  }
  // Organization module management with proper database implementations
  async updateOrganizationModules(organizationId: number, modules: InsertOrganizationModule[]): Promise<OrganizationModule[]> {
    // Delete existing modules for this organization
    await db.delete(organizationModules).where(eq(organizationModules.organizationId, organizationId));
    
    // Insert new modules
    if (modules.length > 0) {
      const newModules = await db.insert(organizationModules).values(modules).returning();
      return newModules;
    }
    return [];
  }
  
  async updateOrganizationModule(organizationId: number, moduleName: AvailableModule, enabled: boolean): Promise<OrganizationModule | undefined> {
    // Check if module exists
    const [existing] = await db.select().from(organizationModules)
      .where(and(eq(organizationModules.organizationId, organizationId), eq(organizationModules.moduleName, moduleName)));
    
    if (existing) {
      // Update existing module
      const [updated] = await db.update(organizationModules)
        .set({ enabled })
        .where(and(eq(organizationModules.organizationId, organizationId), eq(organizationModules.moduleName, moduleName)))
        .returning();
      return updated;
    } else {
      // Create new module
      const [created] = await db.insert(organizationModules)
        .values({ organizationId, moduleName, enabled })
        .returning();
      return created;
    }
  }
  // Activity logging and file management - TODO: Implement database versions when needed
  async logOrganizationActivity(data: any) { return { id: 1, timestamp: new Date() }; }
  async getOrganizationLogs(organizationId: number, page?: number, pageSize?: number) { return []; }
  async createFileRecord(fileRecord: any) { return fileRecord; }
  async getFileRecord(fileId: string) { return null; }
  async deleteFileRecord(fileId: string) { return true; }
  async getTempFiles(cutoffDate: Date) { return []; }
  
  // BOL Document operations
  async createBolDocument(bolDocument: any): Promise<any> {
    const [newDoc] = await db.insert(bolDocuments).values(bolDocument).returning();
    return newDoc;
  }
  
  async getBolDocumentById(id: number): Promise<any | undefined> {
    const [doc] = await db.select().from(bolDocuments).where(eq(bolDocuments.id, id));
    return doc;
  }
  
  async getBolDocumentsByScheduleId(scheduleId: number): Promise<any[]> {
    const docs = await db.select().from(bolDocuments).where(eq(bolDocuments.scheduleId, scheduleId));
    return docs;
  }
  
  async deleteBolDocument(id: number): Promise<boolean> {
    const result = await db.delete(bolDocuments).where(eq(bolDocuments.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  // Organization holidays are implemented above with proper database queries

  async getUserPreferences(userId: number): Promise<UserPreferences | undefined> {
    try {
      const result = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
      return result[0];
    } catch (error) {
      console.error('Error fetching user preferences:', error);
      return undefined;
    }
  }

  async createUserPreferences(preferences: InsertUserPreferences): Promise<UserPreferences> {
    const result = await db.insert(userPreferences).values(preferences).returning();
    return result[0];
  }

  async updateUserPreferences(userId: number, preferencesUpdate: Partial<UserPreferences>): Promise<UserPreferences> {
    try {
      // Check if preferences exist
      const existing = await this.getUserPreferences(userId);
      
      if (existing) {
        // Update existing preferences
        const result = await db.update(userPreferences)
          .set({ ...preferencesUpdate, updatedAt: new Date() })
          .where(eq(userPreferences.userId, userId))
          .returning();
        return result[0];
      } else {
        // Create new preferences with defaults
        const newPreferences = {
          userId,
          organizationId: preferencesUpdate.organizationId || 1,
          emailNotificationsEnabled: true,
          emailScheduleChanges: true,
          emailTruckArrivals: true,
          emailDockAssignments: true,
          emailWeeklyReports: false,
          pushNotificationsEnabled: true,
          pushUrgentAlertsOnly: false,
          pushAllUpdates: false,
          ...preferencesUpdate
        };
        return await this.createUserPreferences(newPreferences);
      }
    } catch (error) {
      console.error('Error updating user preferences:', error);
      throw error;
    }
  }

  async updateUserPassword(id: number, currentPassword: string, newPassword: string): Promise<boolean> {
    try {
      // First verify the current password
      const user = await db.select().from(users).where(eq(users.id, id)).limit(1);
      if (!user[0]) return false;
      
      const isValidPassword = await comparePasswords(currentPassword, user[0].password);
      if (!isValidPassword) return false;
      
      // Hash the new password and update
      const hashedNewPassword = await hashPassword(newPassword);
      await db.update(users).set({ password: hashedNewPassword }).where(eq(users.id, id));
      return true;
    } catch (error) {
      console.error('Error updating user password:', error);
      return false;
    }
  }

  // User/Organization association queries
  async getOrganizationUsers(organizationId: number): Promise<OrganizationUser[]> {
    // Real DB query using organization_users table
    return await db.select().from(organizationUsers).where(eq(organizationUsers.organizationId, organizationId));
  }

  async getUsersByOrganizationId(organizationId: number): Promise<User[]> {
    // Join users and organization_users to fetch users for specific org
    const results = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        createdAt: users.createdAt
      })
      .from(users)
      .innerJoin(organizationUsers, eq(users.id, organizationUsers.userId))
      .where(eq(organizationUsers.organizationId, organizationId));

    return results as unknown as User[]; // Cast due to select subset
  }

  // Override memStorage fallback methods
  async getOrganizationUsersWithRoles(organizationId: number): Promise<any[]> {
    const results = await db
      .select({
        userId: organizationUsers.userId,
        username: users.username,
        email: users.email,
        roleName: roles.name
      })
      .from(organizationUsers)
      .innerJoin(users, eq(organizationUsers.userId, users.id))
      .innerJoin(roles, eq(organizationUsers.roleId, roles.id))
      .where(eq(organizationUsers.organizationId, organizationId));
    return results;
  }

  // OCR Jobs management
  async createOcrJob(ocrJob: InsertOcrJob): Promise<OcrJob> {
    const [newOcrJob] = await db.insert(ocrJobs).values(ocrJob).returning();
    return newOcrJob;
  }

  async getOcrJob(id: number): Promise<OcrJob | undefined> {
    const [ocrJob] = await db.select().from(ocrJobs).where(eq(ocrJobs.id, id)).limit(1);
    return ocrJob;
  }

  async getOcrJobsByStatus(status: string): Promise<OcrJob[]> {
    return await db.select().from(ocrJobs).where(eq(ocrJobs.status, status));
  }

  async updateOcrJob(id: number, ocrJob: Partial<OcrJob>): Promise<OcrJob | undefined> {
    const [updatedOcrJob] = await db
      .update(ocrJobs)
      .set(ocrJob)
      .where(eq(ocrJobs.id, id))
      .returning();
    return updatedOcrJob;
  }

  async updateStandardQuestion(id: number, standardQuestion: Partial<StandardQuestion>): Promise<StandardQuestion | undefined> {
    try {
      const [updated] = await db.update(standardQuestions)
        .set({ ...standardQuestion, lastModifiedAt: new Date() })
        .where(eq(standardQuestions.id, id))
        .returning();
      return updated;
    } catch (error) {
      console.error('Error updating standard question:', error);
      return undefined;
    }
  }

  async saveStandardQuestionsForAppointmentType(appointmentTypeId: number, questions: Partial<StandardQuestion>[]): Promise<StandardQuestion[]> {
    try {
      console.log(`[DatabaseStorage] Saving ${questions.length} standard questions for appointment type ${appointmentTypeId}`);
      
      const savedQuestions: StandardQuestion[] = [];
      
      for (const question of questions) {
        if (question.id) {
          // Update existing question
          const updated = await this.updateStandardQuestion(question.id, {
            ...question,
            appointmentTypeId
          });
          if (updated) {
            savedQuestions.push(updated);
          }
        } else {
          // Create new question
          const created = await this.createStandardQuestion({
            ...question,
            appointmentTypeId,
            label: question.label || 'Untitled Question',
            fieldKey: question.fieldKey || `field_${Date.now()}`,
            fieldType: question.fieldType || 'TEXT',
            included: question.included ?? true,
            required: question.required ?? false,
            orderPosition: question.orderPosition || savedQuestions.length + 1
          } as InsertStandardQuestion);
          savedQuestions.push(created);
        }
      }
      
      console.log(`[DatabaseStorage] Successfully saved ${savedQuestions.length} standard questions`);
      return savedQuestions;
    } catch (error) {
      console.error('Error saving standard questions for appointment type:', error);
      throw error;
    }
  }

  // Password Reset Token methods
  async createPasswordResetToken(userId: number): Promise<PasswordResetToken> {
    // Generate secure random token
    const token = crypto.randomBytes(32).toString('hex');
    
    // Set expiration to 1 hour from now
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    
    // Clean up any existing unused tokens for this user
    await db
      .update(passwordResetTokens)
      .set({ used: true, usedAt: new Date() })
      .where(and(
        eq(passwordResetTokens.userId, userId),
        eq(passwordResetTokens.used, false)
      ));
    
    const [resetToken] = await db
      .insert(passwordResetTokens)
      .values({
        userId,
        token,
        expiresAt,
        used: false
      })
      .returning();
    
    return resetToken;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | null> {
    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(and(
        eq(passwordResetTokens.token, token),
        eq(passwordResetTokens.used, false),
        gte(passwordResetTokens.expiresAt, new Date())
      ));
    
    return resetToken || null;
  }

  async markPasswordResetTokenAsUsed(tokenId: number): Promise<void> {
    await db
      .update(passwordResetTokens)
      .set({ used: true, usedAt: new Date() })
      .where(eq(passwordResetTokens.id, tokenId));
  }

  async cleanupExpiredPasswordResetTokens(): Promise<void> {
    await db
      .delete(passwordResetTokens)
      .where(or(
        eq(passwordResetTokens.used, true),
        lte(passwordResetTokens.expiresAt, new Date())
      ));
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));
    
    return user || null;
  }

  async updateUserPasswordDirect(userId: number, hashedPassword: string): Promise<void> {
    await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, userId));
  }

  async updateUserEmail(userId: number, email: string): Promise<void> {
    await db
      .update(users)
      .set({ email })
      .where(eq(users.id, userId));
  }
}

// Storage instance management
let storageInstance: IStorage | null = null;

export async function getStorage(): Promise<IStorage> {
  if (!storageInstance) {
    // Use database storage if DATABASE_URL is provided, otherwise use memory storage
    if (process.env.DATABASE_URL) {
      logger.info("Using PostgreSQL database storage");
      storageInstance = new DatabaseStorage();
    } else {
      logger.info("Using memory storage for development");
      storageInstance = new MemStorage();
    }
  }
  return storageInstance;
}
