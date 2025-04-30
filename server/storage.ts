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
  BookingPage, InsertBookingPage,
  Asset, InsertAsset,
  CompanyAsset, InsertCompanyAsset, UpdateCompanyAsset,
  Tenant, InsertTenant,
  RoleRecord, InsertRoleRecord,
  OrganizationUser, InsertOrganizationUser,
  OrganizationModule, InsertOrganizationModule, AvailableModule,
  ScheduleStatus, DockStatus, HolidayScope, TimeInterval, AssetCategory,
  users, docks, schedules, carriers, notifications, facilities, holidays, appointmentSettings,
  appointmentTypes, dailyAvailability, customQuestions, bookingPages, assets, companyAssets,
  tenants, roles, organizationUsers, organizationModules, organizationFacilities
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
  getFacility(id: number): Promise<Facility | undefined>;
  getFacilities(tenantId?: number): Promise<Facility[]>;
  getFacilitiesByOrganizationId(organizationId: number): Promise<Facility[]>;
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
  
  // Session store
  sessionStore: any; // Type-safe session store
}

// In-Memory Storage Implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private docks: Map<number, Dock>;
  private schedules: Map<number, Schedule>;
  private carriers: Map<number, Carrier>;
  private facilities: Map<number, Facility>;
  private notifications: Map<number, Notification>;
  private appointmentSettings: Map<number, AppointmentSettings>;
  private appointmentTypes: Map<number, AppointmentType>;
  private dailyAvailability: Map<number, DailyAvailability>;
  private customQuestions: Map<number, CustomQuestion>;
  private bookingPages: Map<number, BookingPage>;
  private assets: Map<number, Asset>;
  private companyAssets: Map<number, CompanyAsset>;
  
  // Admin console related
  private tenants: Map<number, Tenant>;
  private roles: Map<number, RoleRecord>;
  private organizationUsers: Map<number, OrganizationUser>;
  private organizationModules: Map<number, OrganizationModule>;
  
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
  private bookingPageIdCounter: number = 1;
  private assetIdCounter: number = 1;
  private companyAssetIdCounter: number = 1;
  private tenantIdCounter: number = 1;
  private roleIdCounter: number = 1;
  private organizationUserIdCounter: number = 1;
  private organizationModuleIdCounter: number = 1;

  constructor() {
    this.users = new Map();
    this.docks = new Map();
    this.schedules = new Map();
    this.carriers = new Map();
    this.facilities = new Map();
    this.notifications = new Map();
    this.appointmentSettings = new Map();
    this.appointmentTypes = new Map();
    this.dailyAvailability = new Map();
    this.customQuestions = new Map();
    this.bookingPages = new Map();
    this.assets = new Map();
    this.companyAssets = new Map();
    
    // Admin console related
    this.tenants = new Map();
    this.roles = new Map();
    this.organizationUsers = new Map();
    this.organizationModules = new Map();
    
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // 24 hours
    });
    
    // Setup initial data
    this.setupInitialData();
  }

  private setupInitialData() {
    // Create super-admin user
    this.createUser({
      username: "superadmin",
      password: "$2b$10$NrM4S5VFRWKxIFBdSvGQVObcUQZrsquxA3KH9RBKuHKpHHFQXsNGe", // "admin123"
      email: "superadmin@example.com",
      firstName: "Super",
      lastName: "Admin",
      role: "super-admin",
      tenantId: null // Super-admin is not linked to any specific tenant
    });
    
    // Create default admin user
    this.createUser({
      username: "admin",
      password: "$2b$10$NrM4S5VFRWKxIFBdSvGQVObcUQZrsquxA3KH9RBKuHKpHHFQXsNGe", // "admin123"
      email: "admin@example.com",
      firstName: "Admin",
      lastName: "User",
      role: "admin",
    });
    
    // Create test manager
    this.createUser({
      username: "manager",
      password: "$2b$10$NrM4S5VFRWKxIFBdSvGQVObcUQZrsquxA3KH9RBKuHKpHHFQXsNGe", // "admin123"
      email: "manager@example.com",
      firstName: "Manager",
      lastName: "User",
      role: "manager",
    });
    
    // Create testadmin user for testing with plain password - it will be hashed automatically on login
    this.createUser({
      username: "testadmin",
      password: "password123", 
      email: "testadmin@example.com",
      firstName: "Test",
      lastName: "Admin",
      role: "admin",
    });
    
    // Create test dock worker with plain password
    this.createUser({
      username: "worker",
      password: "admin123", 
      email: "worker@example.com",
      firstName: "Dock",
      lastName: "Worker",
      role: "worker",
    });
    
    // Create default tenants/organizations
    const hanzoOrg = this.createTenant({
      name: "Hanzo Logistics",
      subdomain: "hanzo",
      status: "active",
      planLevel: "enterprise",
      contactName: "Hanzo Admin",
      contactEmail: "admin@hanzo.com",
      contactPhone: "555-123-4567",
      maxUsers: 100,
      billingEmail: "billing@hanzo.com"
    });
    
    const acmeOrg = this.createTenant({
      name: "Acme Shipping",
      subdomain: "acme",
      status: "active",
      planLevel: "professional",
      contactName: "Acme Admin",
      contactEmail: "admin@acme.com",
      contactPhone: "555-987-6543",
      maxUsers: 25,
      billingEmail: "billing@acme.com"
    });
    
    // Create role records
    this.createRole({
      name: "super-admin",
      description: "System-wide administrator with access to all organizations and features",
      permissions: { all: true }
    });
    
    this.createRole({
      name: "admin",
      description: "Organization administrator with full access to all organization features",
      permissions: { 
        users: { read: true, create: true, update: true, delete: true },
        facilities: { read: true, create: true, update: true, delete: true },
        docks: { read: true, create: true, update: true, delete: true },
        schedules: { read: true, create: true, update: true, delete: true },
        settings: { read: true, update: true }
      }
    });
    
    this.createRole({
      name: "manager",
      description: "Organization manager with access to scheduling and reporting",
      permissions: { 
        facilities: { read: true },
        docks: { read: true },
        schedules: { read: true, create: true, update: true },
        reports: { read: true },
      }
    });
    
    this.createRole({
      name: "worker",
      description: "Dock worker with limited access to schedules",
      permissions: { 
        schedules: { read: true, update: true }
      }
    });
    
    // Link users to organizations
    this.addUserToOrganization({
      userId: 2, // admin user
      organizationId: 1, // Hanzo
      role: "admin",
      isPrimary: true,
    });
    
    this.addUserToOrganization({
      userId: 3, // manager user
      organizationId: 1, // Hanzo
      role: "manager",
      isPrimary: true,
    });
    
    this.addUserToOrganization({
      userId: 5, // worker user
      organizationId: 1, // Hanzo
      role: "worker",
      isPrimary: true,
    });
    
    // Enable modules for organizations
    const hanzoModules = [
      { name: "doorManager", enabled: true, settings: { maxDoors: 50 } },
      { name: "appointmentManager", enabled: true, settings: { enableExternalBooking: true } },
      { name: "assetManager", enabled: true, settings: { maxAssets: 1000 } },
      { name: "analytics", enabled: true, settings: { enableAdvancedReports: true } }
    ];
    
    const acmeModules = [
      { name: "doorManager", enabled: true, settings: { maxDoors: 20 } },
      { name: "appointmentManager", enabled: true, settings: { enableExternalBooking: true } },
      { name: "assetManager", enabled: false, settings: {} },
      { name: "analytics", enabled: true, settings: { enableAdvancedReports: false } }
    ];
    
    hanzoModules.forEach(module => {
      this.organizationModules.set(this.organizationModuleIdCounter++, {
        id: this.organizationModuleIdCounter,
        organizationId: 1,
        name: module.name,
        enabled: module.enabled,
        settings: module.settings,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });
    
    acmeModules.forEach(module => {
      this.organizationModules.set(this.organizationModuleIdCounter++, {
        id: this.organizationModuleIdCounter,
        organizationId: 2,
        name: module.name,
        enabled: module.enabled,
        settings: module.settings,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });
    
    // Create a default facility
    const mainFacility = this.createFacility({
      name: "Main Warehouse",
      address1: "123 Logistics Way",
      address2: "Building A",
      city: "Indianapolis",
      state: "IN",
      pincode: "46201",
      country: "USA",
      latitude: "39.768403",
      longitude: "-86.158068",
      company: "Hanzo Logistics"
    });
    
    // Create some docks
    const dockNames = ["A-01", "A-02", "A-03", "A-04", "B-01", "B-02", "B-03", "B-04"];
    dockNames.forEach(name => {
      this.createDock({
        name,
        facilityId: 1, // Associate with the main facility
        isActive: true,
        type: "both",
        constraints: { maxTrailerLength: 53, requiresForklift: false }
      });
    });
    
    // Create some carriers
    const carrierNames = ["FedEx", "UPS", "DHL Express", "USPS", "Amazon Logistics", "Swift", "JB Hunt", "YRC"];
    carrierNames.forEach(name => {
      this.createCarrier({
        name,
        contactName: `${name} Contact`,
        contactEmail: `contact@${name.toLowerCase().replace(/\s+/g, '')}.com`,
        contactPhone: "555-123-4567"
      });
    });
    
    // Create default appointment settings for the main facility
    this.createAppointmentSettings({
      facilityId: 1, // Main facility
      timeInterval: TimeInterval.MINUTES_30,
      maxConcurrentInbound: 3,
      maxConcurrentOutbound: 2,
      shareAvailabilityInfo: true,
    });
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const createdAt = new Date();
    const user: User = { ...insertUser, id, createdAt };
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
  
  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }
  
  async updateUserPassword(id: number, hashedPassword: string): Promise<boolean> {
    const user = this.users.get(id);
    if (!user) return false;
    
    user.password = hashedPassword;
    this.users.set(id, user);
    return true;
  }

  // Dock operations
  async getDock(id: number): Promise<Dock | undefined> {
    return this.docks.get(id);
  }

  async getDocks(): Promise<Dock[]> {
    return Array.from(this.docks.values());
  }
  
  async getDocksByFacility(facilityId: number): Promise<Dock[]> {
    return Array.from(this.docks.values()).filter(
      (dock) => dock.facilityId === facilityId
    );
  }

  async createDock(insertDock: InsertDock): Promise<Dock> {
    const id = this.dockIdCounter++;
    const dock: Dock = { ...insertDock, id };
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

  async deleteDock(id: number): Promise<boolean> {
    return this.docks.delete(id);
  }

  // Schedule operations
  async getSchedule(id: number): Promise<Schedule | undefined> {
    return this.schedules.get(id);
  }

  async getSchedules(): Promise<Schedule[]> {
    return Array.from(this.schedules.values());
  }

  async getSchedulesByDock(dockId: number): Promise<Schedule[]> {
    return Array.from(this.schedules.values()).filter(
      (schedule) => schedule.dockId === dockId,
    );
  }

  async getSchedulesByDateRange(startDate: Date, endDate: Date): Promise<Schedule[]> {
    return Array.from(this.schedules.values()).filter(
      (schedule) => 
        new Date(schedule.startTime) >= startDate && 
        new Date(schedule.endTime) <= endDate
    );
  }
  
  async searchSchedules(query: string): Promise<Schedule[]> {
    // Convert query to lowercase for case-insensitive comparison
    const lowerQuery = query.toLowerCase();
    
    // Filter schedules based on the query
    return Array.from(this.schedules.values())
      .filter(schedule => {
        // Search by ID as string match
        if (schedule.id.toString() === query) return true;
        
        // Search by carrier name
        if (schedule.carrierName?.toLowerCase().includes(lowerQuery)) return true;
        
        // Search by customer name
        if (schedule.customerName?.toLowerCase().includes(lowerQuery)) return true;
        
        // Get facility for the dock if it exists
        if (schedule.dockId) {
          const dock = this.docks.get(schedule.dockId);
          if (dock && dock.facilityId) {
            const facility = this.facilities.get(dock.facilityId);
            if (facility && facility.name.toLowerCase().includes(lowerQuery)) return true;
          }
        }
        
        // Search by appointment type if it exists
        if (schedule.appointmentTypeId) {
          const appointmentType = this.appointmentTypes.get(schedule.appointmentTypeId);
          if (appointmentType && appointmentType.name.toLowerCase().includes(lowerQuery)) return true;
        }
        
        return false;
      })
      // Sort by startTime in descending order (newest first)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      // Limit to 10 results
      .slice(0, 10);
  }

  async getScheduleByConfirmationCode(code: string): Promise<Schedule | undefined> {
    // Remove any HC prefix if present and convert to number
    const cleanCode = code.replace(/^HC/, '');
    const scheduleId = parseInt(cleanCode, 10);
    
    if (isNaN(scheduleId)) {
      return undefined;
    }
    
    return this.getSchedule(scheduleId);
  }

  async createSchedule(insertSchedule: InsertSchedule): Promise<Schedule> {
    const id = this.scheduleIdCounter++;
    const createdAt = new Date();
    
    // Set default values for new fields
    const schedule: Schedule = { 
      ...insertSchedule, 
      id, 
      trailerNumber: insertSchedule.trailerNumber || null,
      driverName: insertSchedule.driverName || null,
      driverPhone: insertSchedule.driverPhone || null,
      bolNumber: insertSchedule.bolNumber || null,
      poNumber: insertSchedule.poNumber || null,
      palletCount: insertSchedule.palletCount || null,
      weight: insertSchedule.weight || null,
      appointmentMode: insertSchedule.appointmentMode || "trailer",
      createdAt,
      lastModifiedAt: createdAt,
      lastModifiedBy: insertSchedule.createdBy
    };
    this.schedules.set(id, schedule);
    return schedule;
  }

  async updateSchedule(id: number, scheduleUpdate: Partial<Schedule>): Promise<Schedule | undefined> {
    const schedule = this.schedules.get(id);
    if (!schedule) return undefined;
    
    const lastModifiedAt = new Date();
    const updatedSchedule = { 
      ...schedule, 
      ...scheduleUpdate,
      lastModifiedAt
    };
    this.schedules.set(id, updatedSchedule);
    return updatedSchedule;
  }

  async deleteSchedule(id: number): Promise<boolean> {
    return this.schedules.delete(id);
  }

  // Carrier operations
  async getCarrier(id: number): Promise<Carrier | undefined> {
    return this.carriers.get(id);
  }

  async getCarriers(): Promise<Carrier[]> {
    return Array.from(this.carriers.values());
  }

  async createCarrier(insertCarrier: InsertCarrier): Promise<Carrier> {
    const id = this.carrierIdCounter++;
    const carrier: Carrier = { ...insertCarrier, id, mcNumber: insertCarrier.mcNumber || "" };
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
  
  // Facility operations
  async getFacility(id: number): Promise<Facility | undefined> {
    return this.facilities.get(id);
  }

  async getFacilities(tenantId?: number): Promise<Facility[]> {
    if (tenantId) {
      return this.getFacilitiesByOrganizationId(tenantId);
    }
    return Array.from(this.facilities.values());
  }
  
  async getFacilitiesByOrganizationId(organizationId: number): Promise<Facility[]> {
    // Filter facilities for this organization
    // This is a simplified implementation for in-memory storage
    // In a real database, we'd need to use a proper join with organization_facilities table
    return Array.from(this.facilities.values()).filter(facility => {
      // Check if this facility exists in the organization_facilities mappings
      return Array.from(this.organizationFacilities.values()).some(
        mapping => mapping.organizationId === organizationId && mapping.facilityId === facility.id
      );
    });
  }

  async createFacility(insertFacility: InsertFacility): Promise<Facility> {
    const id = this.facilityIdCounter++;
    const createdAt = new Date();
    const facility: Facility = { ...insertFacility, id, createdAt };
    this.facilities.set(id, facility);
    return facility;
  }

  async updateFacility(id: number, facilityUpdate: Partial<Facility>): Promise<Facility | undefined> {
    const facility = this.facilities.get(id);
    if (!facility) return undefined;
    
    const lastModifiedAt = new Date();
    const updatedFacility = { 
      ...facility, 
      ...facilityUpdate,
      lastModifiedAt
    };
    this.facilities.set(id, updatedFacility);
    return updatedFacility;
  }

  async deleteFacility(id: number): Promise<boolean> {
    return this.facilities.delete(id);
  }

  // Notification operations
  async getNotification(id: number): Promise<Notification | undefined> {
    return this.notifications.get(id);
  }

  async getNotificationsByUser(userId: number): Promise<Notification[]> {
    return Array.from(this.notifications.values()).filter(
      (notification) => notification.userId === userId,
    ).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const id = this.notificationIdCounter++;
    const createdAt = new Date();
    const notification: Notification = { 
      ...insertNotification, 
      id, 
      isRead: false,
      createdAt 
    };
    this.notifications.set(id, notification);
    return notification;
  }

  async markNotificationAsRead(id: number): Promise<Notification | undefined> {
    const notification = this.notifications.get(id);
    if (!notification) return undefined;
    
    const updatedNotification = { ...notification, isRead: true };
    this.notifications.set(id, updatedNotification);
    return updatedNotification;
  }

  // Appointment Settings operations
  async getAppointmentSettings(facilityId: number): Promise<AppointmentSettings | undefined> {
    return Array.from(this.appointmentSettings.values()).find(
      (settings) => settings.facilityId === facilityId
    );
  }

  async createAppointmentSettings(insertSettings: InsertAppointmentSettings): Promise<AppointmentSettings> {
    const id = this.appointmentSettingsIdCounter++;
    const createdAt = new Date();
    const settings: AppointmentSettings = {
      ...insertSettings,
      id,
      createdAt,
      lastModifiedAt: null
    };
    this.appointmentSettings.set(id, settings);
    return settings;
  }

  async updateAppointmentSettings(facilityId: number, settingsUpdate: Partial<AppointmentSettings>): Promise<AppointmentSettings | undefined> {
    const settings = Array.from(this.appointmentSettings.values()).find(
      (settings) => settings.facilityId === facilityId
    );
    if (!settings) return undefined;
    
    const lastModifiedAt = new Date();
    const updatedSettings = {
      ...settings,
      ...settingsUpdate,
      lastModifiedAt
    };
    this.appointmentSettings.set(settings.id, updatedSettings);
    return updatedSettings;
  }

  // Appointment Type operations
  async getAppointmentType(id: number): Promise<AppointmentType | undefined> {
    return this.appointmentTypes.get(id);
  }

  async getAppointmentTypes(): Promise<AppointmentType[]> {
    return Array.from(this.appointmentTypes.values());
  }

  async getAppointmentTypesByFacility(facilityId: number): Promise<AppointmentType[]> {
    return Array.from(this.appointmentTypes.values()).filter(
      (appointmentType) => appointmentType.facilityId === facilityId
    );
  }

  async createAppointmentType(insertAppointmentType: InsertAppointmentType): Promise<AppointmentType> {
    const id = this.appointmentTypeIdCounter++;
    const createdAt = new Date();
    const appointmentType: AppointmentType = {
      ...insertAppointmentType,
      id,
      createdAt,
      lastModifiedAt: null
    };
    this.appointmentTypes.set(id, appointmentType);
    return appointmentType;
  }

  async updateAppointmentType(id: number, appointmentTypeUpdate: Partial<AppointmentType>): Promise<AppointmentType | undefined> {
    const appointmentType = this.appointmentTypes.get(id);
    if (!appointmentType) return undefined;
    
    const lastModifiedAt = new Date();
    const updatedAppointmentType = {
      ...appointmentType,
      ...appointmentTypeUpdate,
      lastModifiedAt
    };
    this.appointmentTypes.set(id, updatedAppointmentType);
    return updatedAppointmentType;
  }

  async deleteAppointmentType(id: number): Promise<boolean> {
    return this.appointmentTypes.delete(id);
  }

  // Daily Availability operations
  async getDailyAvailability(id: number): Promise<DailyAvailability | undefined> {
    return this.dailyAvailability.get(id);
  }

  async getDailyAvailabilityByAppointmentType(appointmentTypeId: number): Promise<DailyAvailability[]> {
    return Array.from(this.dailyAvailability.values()).filter(
      (availability) => availability.appointmentTypeId === appointmentTypeId
    );
  }

  async createDailyAvailability(insertDailyAvailability: InsertDailyAvailability): Promise<DailyAvailability> {
    const id = this.dailyAvailabilityIdCounter++;
    const dailyAvailability: DailyAvailability = {
      ...insertDailyAvailability,
      id
    };
    this.dailyAvailability.set(id, dailyAvailability);
    return dailyAvailability;
  }

  async updateDailyAvailability(id: number, dailyAvailabilityUpdate: Partial<DailyAvailability>): Promise<DailyAvailability | undefined> {
    const dailyAvailability = this.dailyAvailability.get(id);
    if (!dailyAvailability) return undefined;
    
    const updatedDailyAvailability = {
      ...dailyAvailability,
      ...dailyAvailabilityUpdate
    };
    this.dailyAvailability.set(id, updatedDailyAvailability);
    return updatedDailyAvailability;
  }

  async deleteDailyAvailability(id: number): Promise<boolean> {
    return this.dailyAvailability.delete(id);
  }

  // Custom Question operations
  async getCustomQuestion(id: number): Promise<CustomQuestion | undefined> {
    return this.customQuestions.get(id);
  }

  async getCustomQuestionsByAppointmentType(appointmentTypeId: number): Promise<CustomQuestion[]> {
    return Array.from(this.customQuestions.values()).filter(
      (question) => question.appointmentTypeId === appointmentTypeId
    );
  }

  async createCustomQuestion(insertCustomQuestion: InsertCustomQuestion): Promise<CustomQuestion> {
    const id = this.customQuestionIdCounter++;
    const customQuestion: CustomQuestion = {
      ...insertCustomQuestion,
      id
    };
    this.customQuestions.set(id, customQuestion);
    return customQuestion;
  }

  async updateCustomQuestion(id: number, customQuestionUpdate: Partial<CustomQuestion>): Promise<CustomQuestion | undefined> {
    const customQuestion = this.customQuestions.get(id);
    if (!customQuestion) return undefined;
    
    const updatedCustomQuestion = {
      ...customQuestion,
      ...customQuestionUpdate
    };
    this.customQuestions.set(id, updatedCustomQuestion);
    return updatedCustomQuestion;
  }

  async deleteCustomQuestion(id: number): Promise<boolean> {
    return this.customQuestions.delete(id);
  }
  
  // Booking Pages operations
  async getBookingPage(id: number): Promise<BookingPage | undefined> {
    return this.bookingPages.get(id);
  }

  async getBookingPageBySlug(slug: string): Promise<BookingPage | undefined> {
    return Array.from(this.bookingPages.values()).find(
      (page) => page.slug === slug
    );
  }

  async getBookingPages(): Promise<BookingPage[]> {
    return Array.from(this.bookingPages.values());
  }

  async createBookingPage(insertBookingPage: InsertBookingPage): Promise<BookingPage> {
    const id = this.bookingPageIdCounter++;
    const createdAt = new Date();
    const bookingPage: BookingPage = {
      ...insertBookingPage,
      id,
      createdAt,
      lastModifiedAt: null,
      lastModifiedBy: insertBookingPage.createdBy
    };
    this.bookingPages.set(id, bookingPage);
    return bookingPage;
  }

  async updateBookingPage(id: number, bookingPageUpdate: Partial<BookingPage>): Promise<BookingPage | undefined> {
    const bookingPage = this.bookingPages.get(id);
    if (!bookingPage) return undefined;
    
    const lastModifiedAt = new Date();
    const updatedBookingPage = {
      ...bookingPage,
      ...bookingPageUpdate,
      lastModifiedAt
    };
    this.bookingPages.set(id, updatedBookingPage);
    return updatedBookingPage;
  }

  async deleteBookingPage(id: number): Promise<boolean> {
    return this.bookingPages.delete(id);
  }

  // Asset operations
  async getAsset(id: number): Promise<Asset | undefined> {
    return this.assets.get(id);
  }

  async getAssets(): Promise<Asset[]> {
    return Array.from(this.assets.values());
  }

  async getAssetsByUser(userId: number): Promise<Asset[]> {
    return Array.from(this.assets.values()).filter(
      (asset) => asset.uploadedBy === userId
    );
  }

  async createAsset(insertAsset: InsertAsset): Promise<Asset> {
    const id = this.assetIdCounter++;
    const createdAt = new Date();
    const asset: Asset = { ...insertAsset, id, createdAt };
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

  async deleteAsset(id: number): Promise<boolean> {
    return this.assets.delete(id);
  }
  
  // Company Asset operations
  async getCompanyAsset(id: number): Promise<CompanyAsset | undefined> {
    return this.companyAssets.get(id);
  }

  async getCompanyAssets(): Promise<CompanyAsset[]> {
    return Array.from(this.companyAssets.values());
  }
  
  async getFilteredCompanyAssets(filters: Record<string, any>): Promise<CompanyAsset[]> {
    const assets = Array.from(this.companyAssets.values());
    
    // Return all assets if no filters are provided
    if (!filters || Object.keys(filters).length === 0) {
      return assets;
    }
    
    return assets.filter(asset => {
      // Search term (q) filter - check across multiple fields
      if (filters.q) {
        const searchTerm = filters.q.toLowerCase();
        const searchMatch = 
          asset.name.toLowerCase().includes(searchTerm) ||
          asset.manufacturer.toLowerCase().includes(searchTerm) ||
          asset.owner.toLowerCase().includes(searchTerm) ||
          (asset.description && asset.description.toLowerCase().includes(searchTerm)) ||
          (asset.barcode && asset.barcode.toLowerCase().includes(searchTerm)) ||
          (asset.serialNumber && asset.serialNumber.toLowerCase().includes(searchTerm)) ||
          (asset.department && asset.department.toLowerCase().includes(searchTerm));
        
        if (!searchMatch) return false;
      }
      
      // Category filter
      if (filters.category && asset.category !== filters.category) {
        return false;
      }
      
      // Location filter
      if (filters.location && asset.location !== filters.location) {
        return false;
      }
      
      // Status filter
      if (filters.status && asset.status !== filters.status) {
        return false;
      }
      
      // Tags filter
      if (filters.tags) {
        const filterTags = filters.tags.split(',');
        if (filterTags.length > 0) {
          // Skip assets with no tags
          if (!asset.tags) return false;
          
          // Parse asset tags
          try {
            const assetTags = JSON.parse(asset.tags);
            // Check if any filter tag exists in asset tags
            const hasMatchingTag = filterTags.some(tag => assetTags.includes(tag));
            if (!hasMatchingTag) return false;
          } catch (e) {
            // If tags can't be parsed, consider it a non-match
            return false;
          }
        }
      }
      
      return true;
    });
  }

  async createCompanyAsset(insertCompanyAsset: InsertCompanyAsset): Promise<CompanyAsset> {
    const id = this.companyAssetIdCounter++;
    const createdAt = new Date();
    const updatedAt = new Date();
    
    const companyAsset: CompanyAsset = { 
      ...insertCompanyAsset, 
      id, 
      createdAt,
      updatedAt
    };
    
    this.companyAssets.set(id, companyAsset);
    return companyAsset;
  }

  async updateCompanyAsset(id: number, companyAssetUpdate: UpdateCompanyAsset): Promise<CompanyAsset | undefined> {
    const companyAsset = this.companyAssets.get(id);
    if (!companyAsset) return undefined;
    
    const updatedAt = new Date();
    const updatedCompanyAsset = { 
      ...companyAsset, 
      ...companyAssetUpdate,
      updatedAt
    };
    
    this.companyAssets.set(id, updatedCompanyAsset);
    return updatedCompanyAsset;
  }

  async deleteCompanyAsset(id: number): Promise<boolean> {
    return this.companyAssets.delete(id);
  }
  
  // Organization (Tenant) operations
  async getAllTenants(): Promise<Tenant[]> {
    return Array.from(this.tenants.values());
  }
  
  async getTenantById(id: number): Promise<Tenant | undefined> {
    return this.tenants.get(id);
  }
  
  async getTenantBySubdomain(subdomain: string): Promise<Tenant | undefined> {
    return Array.from(this.tenants.values()).find(
      (tenant) => tenant.subdomain === subdomain,
    );
  }
  
  async createTenant(tenant: InsertTenant): Promise<Tenant> {
    const id = this.tenantIdCounter++;
    const createdAt = new Date();
    const newTenant: Tenant = { 
      ...tenant, 
      id, 
      createdAt,
      updatedAt: createdAt
    };
    this.tenants.set(id, newTenant);
    return newTenant;
  }
  
  async updateTenant(id: number, tenantUpdate: Partial<Tenant>): Promise<Tenant | undefined> {
    const tenant = this.tenants.get(id);
    if (!tenant) return undefined;
    
    const updatedAt = new Date();
    const updatedTenant = { 
      ...tenant, 
      ...tenantUpdate,
      updatedAt
    };
    this.tenants.set(id, updatedTenant);
    return updatedTenant;
  }
  
  async deleteTenant(id: number): Promise<boolean> {
    // First delete all organization modules
    const modulesToDelete = Array.from(this.organizationModules.values())
      .filter(module => module.organizationId === id);
    
    modulesToDelete.forEach(module => {
      this.organizationModules.delete(module.id);
    });
    
    // Delete all organization users
    const orgUsersToDelete = Array.from(this.organizationUsers.values())
      .filter(orgUser => orgUser.organizationId === id);
    
    orgUsersToDelete.forEach(orgUser => {
      // Do not delete the actual user, just the organization link
      this.organizationUsers.delete(orgUser.id);
    });
    
    // Finally delete the tenant
    return this.tenants.delete(id);
  }
  
  // Role operations
  async getRole(id: number): Promise<RoleRecord | undefined> {
    return this.roles.get(id);
  }
  
  async getRoleByName(name: string): Promise<RoleRecord | undefined> {
    return Array.from(this.roles.values()).find(
      (role) => role.name === name,
    );
  }
  
  async getRoles(): Promise<RoleRecord[]> {
    return Array.from(this.roles.values());
  }
  
  async createRole(role: InsertRoleRecord): Promise<RoleRecord> {
    const id = this.roleIdCounter++;
    const createdAt = new Date();
    const newRole: RoleRecord = { 
      ...role, 
      id, 
      createdAt,
      updatedAt: createdAt
    };
    this.roles.set(id, newRole);
    return newRole;
  }
  
  // Organization User operations
  async getUsersByOrganizationId(organizationId: number): Promise<User[]> {
    // Find all organization user links for this organization
    const orgUsers = Array.from(this.organizationUsers.values())
      .filter(orgUser => orgUser.organizationId === organizationId);
    
    // Get the user objects for each link
    const users = orgUsers
      .map(orgUser => this.users.get(orgUser.userId))
      .filter((user): user is User => !!user);
    
    return users;
  }
  
  async getOrganizationUsers(organizationId: number): Promise<OrganizationUser[]> {
    return Array.from(this.organizationUsers.values())
      .filter(orgUser => orgUser.organizationId === organizationId);
  }
  
  async getUserOrganizationRole(userId: number, organizationId: number): Promise<OrganizationUser | undefined> {
    return Array.from(this.organizationUsers.values()).find(
      ou => ou.userId === userId && ou.organizationId === organizationId
    );
  }
  
  async addUserToOrganization(orgUser: InsertOrganizationUser): Promise<OrganizationUser> {
    const id = this.organizationUserIdCounter++;
    const createdAt = new Date();
    const newOrgUser: OrganizationUser = { 
      ...orgUser, 
      id, 
      createdAt,
      updatedAt: createdAt 
    };
    this.organizationUsers.set(id, newOrgUser);
    return newOrgUser;
  }
  
  async removeUserFromOrganization(organizationId: number, userId: number): Promise<boolean> {
    // Find the organization user entry
    const orgUser = Array.from(this.organizationUsers.values()).find(
      ou => ou.organizationId === organizationId && ou.userId === userId
    );
    
    if (!orgUser) return false;
    
    // Remove the entry
    return this.organizationUsers.delete(orgUser.id);
  }
  
  // Organization Module operations
  async getOrganizationModules(organizationId: number): Promise<OrganizationModule[]> {
    return Array.from(this.organizationModules.values())
      .filter(module => module.organizationId === organizationId);
  }
  
  async updateOrganizationModules(organizationId: number, modules: InsertOrganizationModule[]): Promise<OrganizationModule[]> {
    // Delete existing modules for this organization
    const existingModules = Array.from(this.organizationModules.values())
      .filter(module => module.organizationId === organizationId);
    
    existingModules.forEach(module => {
      this.organizationModules.delete(module.id);
    });
    
    // Create new modules
    const updatedModules: OrganizationModule[] = [];
    modules.forEach(module => {
      const id = this.organizationModuleIdCounter++;
      const now = new Date();
      const newModule: OrganizationModule = {
        ...module,
        id,
        createdAt: now,
        updatedAt: now
      };
      this.organizationModules.set(id, newModule);
      updatedModules.push(newModule);
    });
    
    return updatedModules;
  }
  
  async updateOrganizationModule(organizationId: number, moduleName: AvailableModule, enabled: boolean): Promise<OrganizationModule | undefined> {
    try {
      // Find existing module
      const existingModule = Array.from(this.organizationModules.values())
        .find(module => module.organizationId === organizationId && module.moduleName === moduleName);
      
      if (existingModule) {
        // Update existing module
        const updatedModule: OrganizationModule = {
          ...existingModule,
          enabled,
          updatedAt: new Date()
        };
        this.organizationModules.set(existingModule.id, updatedModule);
        return updatedModule;
      } else {
        // Create new module
        const id = this.organizationModuleIdCounter++;
        const now = new Date();
        const newModule: OrganizationModule = {
          id,
          organizationId,
          moduleName,
          enabled,
          createdAt: now,
          updatedAt: now
        };
        this.organizationModules.set(id, newModule);
        return newModule;
      }
    } catch (error) {
      console.error(`Error updating module ${moduleName} for organization ${organizationId}:`, error);
      return undefined;
    }
  }
  
  // Organization Activity Logging
  private activityLogs: Map<number, {
    id: number;
    organizationId: number;
    userId: number;
    action: string;
    details: string;
    timestamp: Date;
  }> = new Map();
  private activityLogIdCounter: number = 1;
  
  async logOrganizationActivity(data: { 
    organizationId: number; 
    userId: number; 
    action: string; 
    details: string;
  }): Promise<{ id: number; timestamp: Date }> {
    try {
      const id = this.activityLogIdCounter++;
      const timestamp = new Date();
      
      const log = {
        id,
        organizationId: data.organizationId,
        userId: data.userId,
        action: data.action,
        details: data.details,
        timestamp
      };
      
      this.activityLogs.set(id, log);
      
      return {
        id,
        timestamp
      };
    } catch (error) {
      console.error('Error logging organization activity:', error);
      throw error;
    }
  }
  
  async getOrganizationLogs(organizationId: number, page = 1, pageSize = 20): Promise<Array<{
    id: number;
    timestamp: Date;
    userId: number;
    organizationId: number;
    action: string;
    details: string;
    username?: string;
  }>> {
    try {
      // Filter logs by organization ID
      const orgLogs = Array.from(this.activityLogs.values())
        .filter(log => log.organizationId === organizationId)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()); // Sort by timestamp DESC
      
      // Apply pagination
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedLogs = orgLogs.slice(startIndex, endIndex);
      
      // Enhance logs with username information
      return await Promise.all(paginatedLogs.map(async log => {
        const user = await this.getUser(log.userId);
        return {
          ...log,
          username: user?.username
        };
      }));
    } catch (error) {
      console.error('Error retrieving organization activity logs:', error);
      return [];
    }
  }
}

// Database Storage Implementation
export class DatabaseStorage implements IStorage {
  sessionStore: any; // Using any for session store compatibility

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true
    });
  }
  
  // Role operations
  async getRoleByName(name: string): Promise<RoleRecord | undefined> {
    const [role] = await db.select().from(roles).where(eq(roles.name, name));
    return role;
  }
  
  async getRole(id: number): Promise<RoleRecord | undefined> {
    const [role] = await db.select().from(roles).where(eq(roles.id, id));
    return role;
  }
  
  // Alias for getRole to maintain compatibility with existing code
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
  
  // Add missing getDocksByFacility method
  async getDocksByFacility(facilityId: number): Promise<Dock[]> {
    return await db.select().from(docks).where(eq(docks.facilityId, facilityId));
  }
  
  // Organization User operations
  async getUsersByOrganizationId(organizationId: number): Promise<User[]> {
    const orgUsers = await db.select()
      .from(organizationUsers)
      .where(eq(organizationUsers.organizationId, organizationId));
    
    const userIds = orgUsers.map(ou => ou.userId);
    if (userIds.length === 0) return [];
    
    return await db.select()
      .from(users)
      .where(inArray(users.id, userIds));
  }
  
  async getOrganizationUsers(organizationId: number): Promise<OrganizationUser[]> {
    return await db.select()
      .from(organizationUsers)
      .where(eq(organizationUsers.organizationId, organizationId));
  }
  
  // Get organization users with their role details
  async getOrganizationUsersWithRoles(organizationId: number): Promise<Array<OrganizationUser & { 
    user?: User;
    role?: RoleRecord;
  }>> {
    try {
      // Using raw query for complex join operation
      const result = await pool.query(`
        SELECT ou.*, u.*, r.* 
        FROM organization_users ou
        LEFT JOIN users u ON ou.user_id = u.id
        LEFT JOIN roles r ON ou.role_id = r.id
        WHERE ou.organization_id = $1
      `, [organizationId]);
      
      return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        organizationId: row.organization_id,
        roleId: row.role_id,
        isPrimary: row.is_primary,
        createdAt: row.created_at,
        user: row.username ? {
          id: row.user_id,
          username: row.username,
          email: row.email,
          firstName: row.first_name,
          lastName: row.last_name,
          password: '', // Don't expose password
          role: row.role,
          tenantId: row.tenant_id,
          createdAt: row.created_at
        } : undefined,
        role: row.name ? {
          id: row.role_id,
          name: row.name,
          description: row.description,
          createdAt: row.role_created_at || row.created_at
        } : undefined
      }));
    } catch (error) {
      console.error('Error getting organization users with roles:', error);
      return [];
    }
  }
  
  async getUserOrganizationRole(userId: number, organizationId: number): Promise<OrganizationUser | undefined> {
    const [result] = await db.select()
      .from(organizationUsers)
      .where(and(
        eq(organizationUsers.userId, userId),
        eq(organizationUsers.organizationId, organizationId)
      ));
    return result;
  }
  
  async addUserToOrganization(orgUser: InsertOrganizationUser): Promise<OrganizationUser> {
    const [result] = await db.insert(organizationUsers)
      .values(orgUser)
      .returning();
    return result;
  }
  
  async removeUserFromOrganization(userId: number, organizationId: number): Promise<boolean> {
    const result = await db.delete(organizationUsers)
      .where(and(
        eq(organizationUsers.userId, userId),
        eq(organizationUsers.organizationId, organizationId)
      ));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  // Helper method to add or update a user's role in an organization
  async addUserToOrganizationWithRole(userId: number, organizationId: number, roleId: number): Promise<OrganizationUser> {
    // Check if the user is already in the organization
    const existingUserOrg = await this.getUserOrganizationRole(userId, organizationId);
    
    if (existingUserOrg) {
      // Update existing role
      const [updated] = await db.update(organizationUsers)
        .set({ roleId })
        .where(and(
          eq(organizationUsers.userId, userId),
          eq(organizationUsers.organizationId, organizationId)
        ))
        .returning();
      return updated;
    } else {
      // Create new association
      return await this.addUserToOrganization({
        userId,
        organizationId,
        roleId
      });
    }
  }
  
  // Organization Module operations
  async getOrganizationModules(organizationId: number): Promise<OrganizationModule[]> {
    return await db.select()
      .from(organizationModules)
      .where(eq(organizationModules.organizationId, organizationId));
  }
  
  async updateOrganizationModules(organizationId: number, modules: InsertOrganizationModule[]): Promise<OrganizationModule[]> {
    // Delete existing modules for this organization
    await db.delete(organizationModules)
      .where(eq(organizationModules.organizationId, organizationId));
    
    if (modules.length === 0) return [];
    
    // Insert new modules
    const results = await db.insert(organizationModules)
      .values(modules.map(module => ({
        ...module,
        organizationId
      })))
      .returning();
    
    return results;
  }
  
  async updateOrganizationModule(organizationId: number, moduleName: AvailableModule, enabled: boolean): Promise<OrganizationModule | undefined> {
    try {
      // Check if module exists for this organization
      const [existingModule] = await db.select()
        .from(organizationModules)
        .where(and(
          eq(organizationModules.organizationId, organizationId),
          eq(organizationModules.moduleName, moduleName)
        ));
      
      if (existingModule) {
        // Update existing module
        const [updatedModule] = await db.update(organizationModules)
          .set({ enabled })
          .where(and(
            eq(organizationModules.organizationId, organizationId),
            eq(organizationModules.moduleName, moduleName)
          ))
          .returning();
        
        return updatedModule;
      } else {
        // Create new module
        const [newModule] = await db.insert(organizationModules)
          .values({
            organizationId,
            moduleName,
            enabled
          })
          .returning();
        
        return newModule;
      }
    } catch (error) {
      console.error(`Error updating module ${moduleName} for organization ${organizationId}:`, error);
      return undefined;
    }
  }
  
  // Organization Activity Logging
  async logOrganizationActivity(data: { 
    organizationId: number; 
    userId: number; 
    action: string; 
    details: string;
  }): Promise<{ id: number; timestamp: Date }> {
    try {
      // Insert directly to the database as we don't have a schema object for activity logs
      const result = await pool.query(`
        INSERT INTO activity_logs (organization_id, user_id, action, details)
        VALUES ($1, $2, $3, $4)
        RETURNING id, timestamp
      `, [data.organizationId, data.userId, data.action, data.details]);
      
      if (result.rows && result.rows.length > 0) {
        return {
          id: result.rows[0].id,
          timestamp: result.rows[0].timestamp
        };
      }
      
      throw new Error('Failed to log activity');
    } catch (error) {
      console.error('Error logging organization activity:', error);
      throw error;
    }
  }
  
  // Retrieve organization activity logs with pagination
  async getOrganizationLogs(organizationId: number, page = 1, pageSize = 20): Promise<Array<{
    id: number;
    timestamp: Date;
    userId: number;
    organizationId: number;
    action: string;
    details: string;
    username?: string;
  }>> {
    try {
      const offset = (page - 1) * pageSize;
      
      // Join with users table to get username information
      const result = await pool.query(`
        SELECT al.*, u.username, u.first_name, u.last_name
        FROM activity_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.organization_id = $1
        ORDER BY al.timestamp DESC
        LIMIT $2 OFFSET $3
      `, [organizationId, pageSize, offset]);
      
      return result.rows.map(row => ({
        id: row.id,
        timestamp: row.timestamp,
        userId: row.user_id,
        organizationId: row.organization_id,
        action: row.action,
        details: row.details,
        username: row.username,
        firstName: row.first_name,
        lastName: row.last_name
      }));
    } catch (error) {
      console.error('Error retrieving organization activity logs:', error);
      return [];
    }
  }
  
  // Tenant (Organization) operations
  async getAllTenants(): Promise<Tenant[]> {
    return await db.select().from(tenants);
  }
  
  async getTenantById(id: number): Promise<Tenant | undefined> {
    const [result] = await db.select()
      .from(tenants)
      .where(eq(tenants.id, id));
    return result;
  }
  
  async getTenantBySubdomain(subdomain: string): Promise<Tenant | undefined> {
    const [result] = await db.select()
      .from(tenants)
      .where(eq(tenants.subdomain, subdomain));
    return result;
  }
  
  async getTenantByName(name: string): Promise<Tenant | undefined> {
    const [result] = await db.select()
      .from(tenants)
      .where(eq(tenants.name, name));
    return result;
  }
  
  async createTenant(tenant: InsertTenant): Promise<Tenant> {
    const [result] = await db.insert(tenants)
      .values(tenant)
      .returning();
    return result;
  }
  
  async updateTenant(id: number, tenantUpdate: Partial<Tenant>): Promise<Tenant | undefined> {
    const [result] = await db.update(tenants)
      .set({
        ...tenantUpdate,
        updatedAt: new Date()
      })
      .where(eq(tenants.id, id))
      .returning();
    return result;
  }
  
  // Asset Manager operations
  async getAsset(id: number): Promise<Asset | undefined> {
    const [asset] = await db.select().from(assets).where(eq(assets.id, id));
    return asset;
  }

  async getAssets(): Promise<Asset[]> {
    return await db.select().from(assets);
  }

  async getAssetsByUser(userId: number): Promise<Asset[]> {
    return await db.select().from(assets).where(eq(assets.uploadedBy, userId));
  }

  async createAsset(insertAsset: InsertAsset): Promise<Asset> {
    const [asset] = await db.insert(assets).values(insertAsset).returning();
    return asset;
  }

  async updateAsset(id: number, assetUpdate: Partial<Asset>): Promise<Asset | undefined> {
    const [updatedAsset] = await db
      .update(assets)
      .set(assetUpdate)
      .where(eq(assets.id, id))
      .returning();
    return updatedAsset;
  }

  async deleteAsset(id: number): Promise<boolean> {
    const result = await db.delete(assets).where(eq(assets.id, id)).returning();
    return result.length > 0;
  }
  
  // Company Asset operations
  async getCompanyAsset(id: number): Promise<CompanyAsset | undefined> {
    const [companyAsset] = await db.select().from(companyAssets).where(eq(companyAssets.id, id));
    return companyAsset;
  }

  async getCompanyAssets(): Promise<CompanyAsset[]> {
    return await db.select().from(companyAssets);
  }
  
  async getFilteredCompanyAssets(filters: Record<string, any>): Promise<CompanyAsset[]> {
    let query = db.select().from(companyAssets);
    
    // Apply search term filter
    if (filters.q) {
      const searchTerm = `%${filters.q}%`;
      query = query.where(
        or(
          sql`${companyAssets.name} ILIKE ${searchTerm}`,
          sql`COALESCE(${companyAssets.description}, '') ILIKE ${searchTerm}`,
          sql`${companyAssets.manufacturer} ILIKE ${searchTerm}`,
          sql`COALESCE(${companyAssets.model}, '') ILIKE ${searchTerm}`,
          sql`COALESCE(${companyAssets.notes}, '') ILIKE ${searchTerm}`,
          sql`COALESCE(${companyAssets.department}, '') ILIKE ${searchTerm}`,
          sql`${companyAssets.owner} ILIKE ${searchTerm}`,
          sql`COALESCE(${companyAssets.barcode}, '') ILIKE ${searchTerm}`,
          sql`COALESCE(${companyAssets.serialNumber}, '') ILIKE ${searchTerm}`
        )
      );
    }
    
    // Apply category filter
    if (filters.category) {
      query = query.where(eq(companyAssets.category, filters.category));
    }
    
    // Apply status filter
    if (filters.status) {
      query = query.where(eq(companyAssets.status, filters.status));
    }
    
    // Apply location filter
    if (filters.location) {
      query = query.where(eq(companyAssets.location, filters.location));
    }
    
    // Apply tags filter
    if (filters.tags) {
      const tagList = filters.tags.split(',');
      if (tagList.length > 0) {
        // Get results and filter in memory for tags
        const assets = await query;
        return assets.filter(asset => {
          if (!asset.tags) return false;
          
          try {
            const assetTags = JSON.parse(asset.tags as string);
            return tagList.some(tag => 
              assetTags.includes(tag)
            );
          } catch (e) {
            // If tags can't be parsed, consider it a non-match
            return false;
          }
        });
      }
    }
    
    return await query;
  }

  async createCompanyAsset(insertCompanyAsset: InsertCompanyAsset): Promise<CompanyAsset> {
    const [companyAsset] = await db.insert(companyAssets).values(insertCompanyAsset).returning();
    return companyAsset;
  }

  async updateCompanyAsset(id: number, companyAssetUpdate: UpdateCompanyAsset): Promise<CompanyAsset | undefined> {
    const [updatedCompanyAsset] = await db
      .update(companyAssets)
      .set(companyAssetUpdate)
      .where(eq(companyAssets.id, id))
      .returning();
    return updatedCompanyAsset;
  }

  async deleteCompanyAsset(id: number): Promise<boolean> {
    const result = await db.delete(companyAssets).where(eq(companyAssets.id, id)).returning();
    return result.length > 0;
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  
  async updateUserPassword(id: number, hashedPassword: string): Promise<boolean> {
    const result = await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, id))
      .returning();
    return result.length > 0;
  }
  
  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }
  
  async updateUser(id: number, userUpdate: Partial<User>): Promise<User | undefined> {
    try {
      const [updatedUser] = await db
        .update(users)
        .set(userUpdate)
        .where(eq(users.id, id))
        .returning();
      return updatedUser;
    } catch (error) {
      console.error(`Error updating user ${id}:`, error);
      return undefined;
    }
  }

  // Dock operations
  async getDock(id: number): Promise<Dock | undefined> {
    const [dock] = await db.select().from(docks).where(eq(docks.id, id));
    return dock;
  }

  async getDocks(): Promise<Dock[]> {
    return await db.select().from(docks);
  }

  async createDock(insertDock: InsertDock): Promise<Dock> {
    const [dock] = await db.insert(docks).values(insertDock).returning();
    return dock;
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
    const result = await db
      .delete(docks)
      .where(eq(docks.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Schedule operations
  async getSchedule(id: number): Promise<Schedule | undefined> {
    try {
      // Use pool's query directly, joining with related tables to get facility info
      const result = await pool.query(`
        SELECT s.*, d.name as dock_name, f.name as facility_name, f.id as facility_id,
               at.name as appointment_type_name
        FROM schedules s
        LEFT JOIN docks d ON s.dock_id = d.id
        LEFT JOIN facilities f ON d.facility_id = f.id
        LEFT JOIN appointment_types at ON s.appointment_type_id = at.id
        WHERE s.id = $1 LIMIT 1
      `, [id]);
      
      if (result.rows.length === 0) {
        return undefined;
      }
      
      const row = result.rows[0];
      
      // Extract facility information - prioritize the explicit saved values 
      // from customFormData over the joined values
      let facilityName = null;
      let facilityId = null;
      
      // First check if we have explicitly saved facility info
      if (row.custom_form_data && row.custom_form_data.facilityInfo) {
        facilityName = row.custom_form_data.facilityInfo.facilityName;
        facilityId = row.custom_form_data.facilityInfo.facilityId;
      }
      
      // Fall back to joined table values if explicit values aren't available
      facilityName = facilityName || row.facility_name;
      facilityId = facilityId || row.facility_id;
      
      // Convert snake_case database columns to camelCase for our interface
      return {
        id: row.id,
        type: row.type,
        status: row.status,
        dockId: row.dock_id,
        dockName: row.dock_name,
        facilityId: facilityId,
        facilityName: facilityName,
        carrierId: row.carrier_id,
        appointmentTypeId: row.appointment_type_id,
        appointmentTypeName: row.appointment_type_name,
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
        weight: row.weight,
        appointmentMode: row.appointment_mode,
        startTime: row.start_time,
        endTime: row.end_time,
        actualStartTime: row.actual_start_time,
        actualEndTime: row.actual_end_time,
        notes: row.notes,
        customFormData: row.custom_form_data,
        createdAt: row.created_at,
        createdBy: row.created_by,
        lastModifiedAt: row.last_modified_at,
        lastModifiedBy: row.last_modified_by
      };
    } catch (error) {
      console.error("Error executing getSchedule:", error);
      throw error;
    }
  }

  async getSchedules(tenantId?: number): Promise<Schedule[]> {
    try {
      // Build the query with a tenant filter if a tenantId is provided
      let query = `SELECT schedules.*, facilities.name AS facility_name 
                  FROM schedules 
                  LEFT JOIN docks ON schedules.dock_id = docks.id
                  LEFT JOIN facilities ON docks.facility_id = facilities.id`;
      
      const params: any[] = [];
      
      // Add tenant filtering if a tenantId is provided
      if (tenantId) {
        // Filter by organization's facilities
        query += ` WHERE EXISTS (
          SELECT 1 FROM organization_facilities of 
          WHERE of.facility_id = facilities.id 
          AND of.organization_id = $1
        )`;
        
        params.push(tenantId);
      }
      
      // Execute the query with or without the tenant filter
      const result = await pool.query(query, params);
      
      // Transform to match our expected Schedule interface
      return result.rows.map((row: any) => {
        // Extract facility information - prioritize the explicitly saved values 
        // from customFormData over the joined values
        let facilityName = null;
        let facilityId = null;
        
        // First check if we have explicitly saved facility info
        if (row.custom_form_data && row.custom_form_data.facilityInfo) {
          facilityName = row.custom_form_data.facilityInfo.facilityName;
          facilityId = row.custom_form_data.facilityInfo.facilityId;
        }
        
        // Fall back to joined table values if explicit values aren't available
        facilityName = facilityName || row.facility_name;
        facilityId = facilityId || row.facility_id;
        
        return {
          id: row.id,
          type: row.type,
          status: row.status,
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
          facilityName: facilityName,
          facilityId: facilityId,
          poNumber: row.po_number,
          palletCount: row.pallet_count,
          weight: row.weight,
          appointmentMode: row.appointment_mode || "trailer",
          startTime: row.start_time,
          endTime: row.end_time,
          actualStartTime: row.actual_start_time,
          actualEndTime: row.actual_end_time,
          notes: row.notes,
          customFormData: row.custom_form_data,
          createdAt: row.created_at,
          createdBy: row.created_by,
          lastModifiedAt: row.last_modified_at,
          lastModifiedBy: row.last_modified_by
        };
      });
    } catch (error) {
      console.error("Error executing getSchedules:", error);
      throw error;
    }
  }

  async getSchedulesByDock(dockId: number): Promise<Schedule[]> {
    try {
      // Use pool to query directly - join with facilities to get facility data
      const result = await pool.query(`
        SELECT s.*, d.name as dock_name, f.name as facility_name, f.id as facility_id
        FROM schedules s
        LEFT JOIN docks d ON s.dock_id = d.id
        LEFT JOIN facilities f ON d.facility_id = f.id
        WHERE s.dock_id = $1
      `, [dockId]);
      
      // Transform to match our expected Schedule interface
      return result.rows.map((row: any) => {
        // Extract facility information - prioritize the explicitly saved values 
        // from customFormData over the joined values
        let facilityName = null;
        let facilityId = null;
        
        // First check if we have explicitly saved facility info
        if (row.custom_form_data && row.custom_form_data.facilityInfo) {
          facilityName = row.custom_form_data.facilityInfo.facilityName;
          facilityId = row.custom_form_data.facilityInfo.facilityId;
        }
        
        // Fall back to joined table values if explicit values aren't available
        facilityName = facilityName || row.facility_name;
        facilityId = facilityId || row.facility_id;
        
        return {
          id: row.id,
          type: row.type,
          status: row.status,
          dockId: row.dock_id,
          dockName: row.dock_name,
          facilityId: facilityId,
          facilityName: facilityName,
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
          weight: row.weight,
          appointmentMode: row.appointment_mode || "trailer",
          startTime: row.start_time,
          endTime: row.end_time,
          actualStartTime: row.actual_start_time,
          actualEndTime: row.actual_end_time,
          notes: row.notes,
          customFormData: row.custom_form_data,
          createdAt: row.created_at,
          createdBy: row.created_by,
          lastModifiedAt: row.last_modified_at,
          lastModifiedBy: row.last_modified_by
        };
      });
    } catch (error) {
      console.error("Error executing getSchedulesByDock:", error);
      throw error;
    }
  }

  async getSchedulesByDateRange(startDate: Date, endDate: Date, tenantId?: number): Promise<Schedule[]> {
    try {
      // Build the query with parameters
      let query = `
        SELECT s.*, d.name as dock_name, f.name as facility_name, f.id as facility_id, 
               at.name as appointment_type_name
        FROM schedules s
        LEFT JOIN docks d ON s.dock_id = d.id
        LEFT JOIN facilities f ON d.facility_id = f.id
        LEFT JOIN appointment_types at ON s.appointment_type_id = at.id
        WHERE s.start_time >= $1 AND s.end_time <= $2`;
      
      const params: any[] = [startDate, endDate];
      
      // Add tenant filtering if a tenantId is provided
      if (tenantId) {
        query += ` AND EXISTS (
          SELECT 1 FROM organization_facilities of 
          WHERE of.facility_id = f.id 
          AND of.organization_id = $3
        )`;
        params.push(tenantId);
      }
      
      // Execute the query with parameters
      const result = await pool.query(query, params);
      
      // Transform to match our expected Schedule interface
      return result.rows.map((row: any) => {
        return {
          id: row.id,
          type: row.type,
          status: row.status,
          dockId: row.dock_id,
          dockName: row.dock_name,
          facilityId: row.facility_id,
          facilityName: row.facility_name,
          carrierId: row.carrier_id,
          appointmentTypeId: row.appointment_type_id,
          appointmentTypeName: row.appointment_type_name,
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
          weight: row.weight,
          appointmentMode: row.appointment_mode || "trailer",
          startTime: row.start_time,
          endTime: row.end_time,
          actualStartTime: row.actual_start_time,
          actualEndTime: row.actual_end_time,
          notes: row.notes,
          customFormData: row.custom_form_data,
          createdAt: row.created_at,
          createdBy: row.created_by,
          lastModifiedAt: row.last_modified_at,
          lastModifiedBy: row.last_modified_by
        };
      });
    } catch (error) {
      console.error("Error executing getSchedulesByDateRange:", error);
      throw error;
    }
  }

  async searchSchedules(query: string): Promise<Schedule[]> {
    try {
      // Create a sanitized version of the query for SQL
      const searchPattern = `%${query}%`;
      
      // Use pool to query directly - join with facilities and appointment_types to get better data
      // Search by ID (direct match), carrier name, customer name, facility name or appointment type
      const result = await pool.query(`
        SELECT s.*, d.name as dock_name, f.name as facility_name, f.id as facility_id, 
               at.name as appointment_type_name
        FROM schedules s
        LEFT JOIN docks d ON s.dock_id = d.id
        LEFT JOIN facilities f ON d.facility_id = f.id
        LEFT JOIN appointment_types at ON s.appointment_type_id = at.id
        WHERE 
          s.id::text = $1
          OR LOWER(s.carrier_name) LIKE LOWER($2)
          OR LOWER(s.customer_name) LIKE LOWER($2)
          OR LOWER(f.name) LIKE LOWER($2)
          OR LOWER(at.name) LIKE LOWER($2)
        ORDER BY s.start_time DESC
        LIMIT 10
      `, [query, searchPattern]);
      
      // Transform to match our expected Schedule interface
      return result.rows.map((row: any) => {
        return {
          id: row.id,
          type: row.type,
          status: row.status,
          dockId: row.dock_id,
          dockName: row.dock_name,
          facilityId: row.facility_id,
          facilityName: row.facility_name,
          carrierId: row.carrier_id,
          appointmentTypeId: row.appointment_type_id,
          appointmentTypeName: row.appointment_type_name,
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
          weight: row.weight,
          appointmentMode: row.appointment_mode || "trailer",
          startTime: row.start_time,
          endTime: row.end_time,
          actualStartTime: row.actual_start_time,
          actualEndTime: row.actual_end_time,
          notes: row.notes,
          customFormData: row.custom_form_data,
          createdAt: row.created_at,
          createdBy: row.created_by,
          lastModifiedAt: row.last_modified_at,
          lastModifiedBy: row.last_modified_by
        };
      });
    } catch (error) {
      console.error("Error executing searchSchedules:", error);
      throw error;
    }
  }

  async getScheduleByConfirmationCode(code: string): Promise<Schedule | undefined> {
    try {
      // Remove any HC prefix if present and convert to number
      const cleanCode = code.replace(/^HC/, '');
      const scheduleId = parseInt(cleanCode, 10);
      
      if (isNaN(scheduleId)) {
        return undefined;
      }
      
      // For now, simply call getSchedule with the ID
      // In the future, we might want a more sophisticated confirmation code system
      return this.getSchedule(scheduleId);
    } catch (error) {
      console.error("Error executing getScheduleByConfirmationCode:", error);
      throw error;
    }
  }

  async createSchedule(insertSchedule: any): Promise<Schedule> {
    // Instead of using the ORM, let's use a direct SQL query to avoid the schema mismatch
    try {
      console.log("Raw insertSchedule in storage:", JSON.stringify(insertSchedule, null, 2));
      
      // Extract values from insertSchedule that match the actual database columns
      // Manually ensure dates are Date objects
      const startTime = typeof insertSchedule.startTime === 'string' 
        ? new Date(insertSchedule.startTime) 
        : insertSchedule.startTime;
        
      const endTime = typeof insertSchedule.endTime === 'string' 
        ? new Date(insertSchedule.endTime) 
        : insertSchedule.endTime;
      
      // Store facility information as metadata
      let facilityMetadata = {};
      if (insertSchedule.facilityId || insertSchedule.facilityName || insertSchedule.facilityTimezone) {
        facilityMetadata = {
          facilityId: insertSchedule.facilityId,
          facilityName: insertSchedule.facilityName,
          facilityTimezone: insertSchedule.facilityTimezone
        };
      }
      
      const values = {
        dock_id: insertSchedule.dockId,
        carrier_id: insertSchedule.carrierId !== undefined ? insertSchedule.carrierId : null,
        truck_number: insertSchedule.truckNumber || '',
        trailer_number: insertSchedule.trailerNumber || null,
        driver_name: insertSchedule.driverName || null,
        driver_phone: insertSchedule.driverPhone || null,
        driver_email: insertSchedule.driverEmail || null,
        customer_name: insertSchedule.customerName || null,
        carrier_name: insertSchedule.carrierName || null,
        mc_number: insertSchedule.mcNumber || null,
        bol_number: insertSchedule.bolNumber || null,
        po_number: insertSchedule.poNumber || null,
        pallet_count: insertSchedule.palletCount || null,
        weight: insertSchedule.weight || null,
        appointment_mode: insertSchedule.appointmentMode || 'trailer',
        appointment_type_id: insertSchedule.appointmentTypeId || null,
        custom_form_data: Object.keys(facilityMetadata).length > 0 
          ? { ...insertSchedule.customFormData, facilityInfo: facilityMetadata }
          : insertSchedule.customFormData || null,
        start_time: startTime,
        end_time: endTime,
        type: insertSchedule.type,
        status: insertSchedule.status,
        notes: insertSchedule.notes || null,
        created_by: insertSchedule.createdBy,
        created_at: new Date(),
        last_modified_at: new Date(),
        last_modified_by: insertSchedule.createdBy
      };
      
      // Construct the SQL query
      const fields = Object.keys(values).map(k => k).join(', ');
      const placeholders = Object.keys(values).map((_, i) => `$${i + 1}`).join(', ');
      
      const query = `
        INSERT INTO schedules (${fields})
        VALUES (${placeholders})
        RETURNING *
      `;
      
      // Execute the query
      const result = await pool.query(query, Object.values(values));
      const schedule = result.rows[0];
      
      // Add the appointmentTypeId back to the returned object to match the TypeScript type
      return { ...schedule, appointmentTypeId: insertSchedule.appointmentTypeId || null } as Schedule;
    } catch (error) {
      console.error("Error creating schedule:", error);
      throw error;
    }
  }

  async updateSchedule(id: number, scheduleUpdate: Partial<Schedule>): Promise<Schedule | undefined> {
    try {
      // Extract appointmentTypeId from the update object
      const { appointmentTypeId, ...updateWithoutAppointmentTypeId } = scheduleUpdate;
      
      // Create an object with all the valid database columns
      const updateFields: Record<string, any> = {};
      
      // Add each field that exists in the database schema
      if ('dockId' in updateWithoutAppointmentTypeId) updateFields.dock_id = updateWithoutAppointmentTypeId.dockId;
      if ('carrierId' in updateWithoutAppointmentTypeId) updateFields.carrier_id = updateWithoutAppointmentTypeId.carrierId !== undefined ? updateWithoutAppointmentTypeId.carrierId : null;
      if ('truckNumber' in updateWithoutAppointmentTypeId) updateFields.truck_number = updateWithoutAppointmentTypeId.truckNumber;
      if ('trailerNumber' in updateWithoutAppointmentTypeId) updateFields.trailer_number = updateWithoutAppointmentTypeId.trailerNumber;
      if ('driverName' in updateWithoutAppointmentTypeId) updateFields.driver_name = updateWithoutAppointmentTypeId.driverName;
      if ('driverPhone' in updateWithoutAppointmentTypeId) updateFields.driver_phone = updateWithoutAppointmentTypeId.driverPhone;
      if ('driverEmail' in updateWithoutAppointmentTypeId) updateFields.driver_email = updateWithoutAppointmentTypeId.driverEmail;
      if ('customerName' in updateWithoutAppointmentTypeId) updateFields.customer_name = updateWithoutAppointmentTypeId.customerName;
      if ('carrierName' in updateWithoutAppointmentTypeId) updateFields.carrier_name = updateWithoutAppointmentTypeId.carrierName;
      if ('mcNumber' in updateWithoutAppointmentTypeId) updateFields.mc_number = updateWithoutAppointmentTypeId.mcNumber;
      if ('bolNumber' in updateWithoutAppointmentTypeId) updateFields.bol_number = updateWithoutAppointmentTypeId.bolNumber;
      if ('poNumber' in updateWithoutAppointmentTypeId) updateFields.po_number = updateWithoutAppointmentTypeId.poNumber;
      if ('palletCount' in updateWithoutAppointmentTypeId) updateFields.pallet_count = updateWithoutAppointmentTypeId.palletCount;
      if ('weight' in updateWithoutAppointmentTypeId) updateFields.weight = updateWithoutAppointmentTypeId.weight;
      if ('appointmentMode' in updateWithoutAppointmentTypeId) updateFields.appointment_mode = updateWithoutAppointmentTypeId.appointmentMode;
      if ('startTime' in updateWithoutAppointmentTypeId) updateFields.start_time = updateWithoutAppointmentTypeId.startTime;
      if ('endTime' in updateWithoutAppointmentTypeId) updateFields.end_time = updateWithoutAppointmentTypeId.endTime;
      if ('actualStartTime' in updateWithoutAppointmentTypeId) updateFields.actual_start_time = updateWithoutAppointmentTypeId.actualStartTime;
      if ('actualEndTime' in updateWithoutAppointmentTypeId) updateFields.actual_end_time = updateWithoutAppointmentTypeId.actualEndTime;
      if ('type' in updateWithoutAppointmentTypeId) updateFields.type = updateWithoutAppointmentTypeId.type;
      if ('status' in updateWithoutAppointmentTypeId) updateFields.status = updateWithoutAppointmentTypeId.status;
      if ('notes' in updateWithoutAppointmentTypeId) updateFields.notes = updateWithoutAppointmentTypeId.notes;
      if ('customFormData' in updateWithoutAppointmentTypeId) updateFields.custom_form_data = updateWithoutAppointmentTypeId.customFormData;
      
      // Always update last_modified_at
      updateFields.last_modified_at = new Date();
      if ('lastModifiedBy' in updateWithoutAppointmentTypeId) updateFields.last_modified_by = updateWithoutAppointmentTypeId.lastModifiedBy;
      
      // Early return if no fields to update
      if (Object.keys(updateFields).length === 0) {
        return undefined;
      }
      
      // Construct query parts
      const setClause = Object.entries(updateFields)
        .map(([key, _], index) => `${key} = $${index + 2}`)
        .join(', ');
      
      // Build the query
      const query = `
        UPDATE schedules
        SET ${setClause}
        WHERE id = $1
        RETURNING *
      `;
      
      // Execute the query with parameters
      const result = await pool.query(query, [id, ...Object.values(updateFields)]);
      
      if (result.rows.length === 0) {
        return undefined;
      }
      
      const updatedSchedule = result.rows[0];
      
      // Add the appointmentTypeId back to match the TypeScript type
      return { ...updatedSchedule, appointmentTypeId: appointmentTypeId || null } as Schedule;
    } catch (error) {
      console.error("Error updating schedule:", error);
      throw error;
    }
  }

  async deleteSchedule(id: number): Promise<boolean> {
    try {
      const result = await pool.query(
        `DELETE FROM schedules WHERE id = $1`, 
        [id]
      );
      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      console.error("Error deleting schedule:", error);
      throw error;
    }
  }

  // Carrier operations
  async getCarrier(id: number): Promise<Carrier | undefined> {
    const [carrier] = await db.select().from(carriers).where(eq(carriers.id, id));
    return carrier;
  }

  async getCarriers(): Promise<Carrier[]> {
    return await db.select().from(carriers);
  }

  async createCarrier(insertCarrier: InsertCarrier): Promise<Carrier> {
    const [carrier] = await db.insert(carriers).values(insertCarrier).returning();
    return carrier;
  }
  
  async updateCarrier(id: number, carrierUpdate: Partial<Carrier>): Promise<Carrier | undefined> {
    const [updatedCarrier] = await db
      .update(carriers)
      .set(carrierUpdate)
      .where(eq(carriers.id, id))
      .returning();
    return updatedCarrier;
  }

  // Facility operations
  async getFacility(id: number, tenantId?: number): Promise<Facility | undefined> {
    // If no tenant ID is provided, return the facility without tenant isolation
    if (!tenantId) {
      const [facility] = await db.select().from(facilities).where(eq(facilities.id, id));
      return facility;
    }
    
    // If tenant ID is provided, check if this facility belongs to the organization
    try {
      // Use a join query to ensure facility belongs to the organization
      const query = `
        SELECT f.* FROM facilities f
        JOIN organization_facilities of ON f.id = of.facility_id
        WHERE f.id = $1 AND of.organization_id = $2
        LIMIT 1
      `;
      
      const result = await pool.query(query, [id, tenantId]);
      
      if (result.rows.length === 0) {
        console.log(`[getFacility] Facility ${id} does not belong to organization ${tenantId}`);
        return undefined;
      }
      
      console.log(`[getFacility] Successfully retrieved facility ${id} for organization ${tenantId}`);
      return result.rows[0];
    } catch (error) {
      console.error(`[getFacility] Error retrieving facility ${id} for organization ${tenantId}:`, error);
      return undefined;
    }
  }

  async getFacilities(tenantId?: number): Promise<Facility[]> {
    try {
      // If tenant ID provided, filter facilities by organization
      if (tenantId) {
        return this.getFacilitiesByOrganizationId(tenantId);
      }
      
      // Return all facilities for super admin - use the SQL query to avoid column naming issues
      const query = `SELECT * FROM facilities`;
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      console.error("Error in getFacilities:", error);
      throw error;
    }
  }
  
  async getFacilitiesByOrganizationId(organizationId: number): Promise<Facility[]> {
    try {
      // Use a join query to get facilities that belong to this organization
      const query = `
        SELECT f.* FROM facilities f
        JOIN organization_facilities of ON f.id = of.facility_id
        WHERE of.organization_id = $1
      `;
      
      const result = await pool.query(query, [organizationId]);
      console.log(`Found ${result.rows.length} facilities for organization ${organizationId}`);
      return result.rows;
    } catch (error) {
      console.error('Error getting facilities by organization ID:', error);
      return [];
    }
  }
  
  async getOrganizationByFacilityId(facilityId: number): Promise<{ id: number; name: string } | null> {
    try {
      // Find the organization that owns this facility
      const query = `
        SELECT t.id, t.name 
        FROM tenants t
        JOIN organization_facilities of ON t.id = of.organization_id
        WHERE of.facility_id = $1
        LIMIT 1
      `;
      
      const result = await pool.query(query, [facilityId]);
      
      if (result.rows.length === 0) {
        console.log(`No organization found for facility ${facilityId}`);
        return null;
      }
      
      console.log(`Found organization "${result.rows[0].name}" (ID: ${result.rows[0].id}) for facility ${facilityId}`);
      return result.rows[0];
    } catch (error) {
      console.error(`Error getting organization for facility ${facilityId}:`, error);
      return null;
    }
  }

  async createFacility(insertFacility: InsertFacility): Promise<Facility> {
    const [facility] = await db.insert(facilities).values(insertFacility).returning();
    return facility;
  }

  async updateFacility(id: number, facilityUpdate: Partial<Facility>): Promise<Facility | undefined> {
    try {
      // Use direct SQL to avoid tenantId/tenant_id column name issues
      const updateColumns = Object.keys(facilityUpdate)
        .filter(key => key !== 'id' && key !== 'createdAt') // Skip these fields
        .map(key => {
          // Convert camelCase to snake_case for SQL
          const sqlKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
          return `"${sqlKey}" = $${Object.keys(facilityUpdate).indexOf(key) + 2}`;
        })
        .join(', ');
      
      // Add last_modified_at to updated columns
      const fullUpdateSql = `${updateColumns}, "last_modified_at" = NOW()`;
      
      // Create the complete SQL query
      const query = `
        UPDATE facilities
        SET ${fullUpdateSql}
        WHERE id = $1
        RETURNING *
      `;
      
      // Extract values in correct order
      const values = [id];
      Object.keys(facilityUpdate)
        .filter(key => key !== 'id' && key !== 'createdAt')
        .forEach(key => {
          values.push(facilityUpdate[key]);
        });
      
      console.log(`Updating facility ${id} with:`, JSON.stringify(facilityUpdate, null, 2));
      
      const result = await pool.query(query, values);
      
      if (result.rows.length === 0) {
        console.log(`No facility found with ID ${id}`);
        return undefined;
      }
      
      return result.rows[0];
    } catch (error) {
      console.error(`Error updating facility ${id}:`, error);
      throw error;
    }
  }

  async deleteFacility(id: number): Promise<boolean> {
    const result = await db
      .delete(facilities)
      .where(eq(facilities.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Notification operations
  async getNotification(id: number): Promise<Notification | undefined> {
    const [notification] = await db.select().from(notifications).where(eq(notifications.id, id));
    return notification;
  }

  async getNotificationsByUser(userId: number): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(notifications.createdAt);
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const [notification] = await db
      .insert(notifications)
      .values({
        ...insertNotification,
        isRead: false
      })
      .returning();
    return notification;
  }

  async markNotificationAsRead(id: number): Promise<Notification | undefined> {
    const [notification] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id))
      .returning();
    return notification;
  }

  // Appointment Settings operations
  async getAppointmentSettings(facilityId: number): Promise<AppointmentSettings | undefined> {
    try {
      // Note: There's a mismatch between the schema definition and the actual DB.
      // Some columns like sunday, monday, etc. are defined in schema.ts but not in DB.
      // Get only the columns that exist in the database
      const [dbSettings] = await db
        .select({
          id: appointmentSettings.id,
          facilityId: appointmentSettings.facilityId,
          timeInterval: appointmentSettings.timeInterval,
          maxConcurrentInbound: appointmentSettings.maxConcurrentInbound,
          maxConcurrentOutbound: appointmentSettings.maxConcurrentOutbound,
          shareAvailabilityInfo: appointmentSettings.shareAvailabilityInfo,
          createdAt: appointmentSettings.createdAt,
          lastModifiedAt: appointmentSettings.lastModifiedAt
        })
        .from(appointmentSettings)
        .where(eq(appointmentSettings.facilityId, facilityId));
        
      if (!dbSettings) return undefined;
      
      // Synthesize the full settings object with default values for missing columns
      const fullSettings: any = {
        ...dbSettings,
        // Default day availability (weekdays open, weekends closed)
        sunday: false,
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        
        // Default time windows (8am-5pm for all days)
        sundayStartTime: "08:00",
        sundayEndTime: "17:00",
        mondayStartTime: "08:00",
        mondayEndTime: "17:00",
        tuesdayStartTime: "08:00",
        tuesdayEndTime: "17:00",
        wednesdayStartTime: "08:00",
        wednesdayEndTime: "17:00",
        thursdayStartTime: "08:00",
        thursdayEndTime: "17:00",
        fridayStartTime: "08:00",
        fridayEndTime: "17:00",
        saturdayStartTime: "08:00",
        saturdayEndTime: "17:00",
        
        // Default breaks (12pm-1pm for all days)
        sundayBreakStartTime: "12:00",
        sundayBreakEndTime: "13:00",
        mondayBreakStartTime: "12:00",
        mondayBreakEndTime: "13:00",
        tuesdayBreakStartTime: "12:00",
        tuesdayBreakEndTime: "13:00",
        wednesdayBreakStartTime: "12:00",
        wednesdayBreakEndTime: "13:00",
        thursdayBreakStartTime: "12:00",
        thursdayBreakEndTime: "13:00",
        fridayBreakStartTime: "12:00",
        fridayBreakEndTime: "13:00",
        saturdayBreakStartTime: "12:00",
        saturdayBreakEndTime: "13:00",
        
        // Default max appointments
        sundayMaxAppointments: 0,
        mondayMaxAppointments: 0,
        tuesdayMaxAppointments: 0,
        wednesdayMaxAppointments: 0,
        thursdayMaxAppointments: 0,
        fridayMaxAppointments: 0,
        saturdayMaxAppointments: 0,
        
        // Other defaults
        defaultBufferTime: 0,
        defaultGracePeriod: 15,
        defaultEmailReminderTime: 24,
        allowAppointmentsThroughBreaks: false,
        allowAppointmentsPastBusinessHours: false
      };
      
      return fullSettings as AppointmentSettings;
    } catch (error) {
      console.error("Error fetching appointment settings:", error);
      return undefined;
    }
  }

  async createAppointmentSettings(insertSettings: InsertAppointmentSettings): Promise<AppointmentSettings> {
    const [settings] = await db
      .insert(appointmentSettings)
      .values({
        ...insertSettings,
        lastModifiedAt: null
      })
      .returning();
    return settings;
  }

  async updateAppointmentSettings(facilityId: number, settingsUpdate: Partial<AppointmentSettings>): Promise<AppointmentSettings | undefined> {
    const [updatedSettings] = await db
      .update(appointmentSettings)
      .set({
        ...settingsUpdate,
        lastModifiedAt: new Date()
      })
      .where(eq(appointmentSettings.facilityId, facilityId))
      .returning();
    return updatedSettings;
  }

  // Appointment Type operations
  async getAppointmentType(id: number, tenantId?: number): Promise<AppointmentType | undefined> {
    console.log(`[getAppointmentType] Fetching appointment type with ID: ${id}${tenantId ? `, for tenant: ${tenantId}` : ''}`);
    
    let query = db
      .select()
      .from(appointmentTypes)
      .where(eq(appointmentTypes.id, id));
      
    // If tenantId is provided, add tenant filter
    if (tenantId !== undefined) {
      query = query.where(eq(appointmentTypes.tenantId, tenantId));
    }
    
    const [appointmentType] = await query;
    
    if (appointmentType) {
      console.log(`[getAppointmentType] Found appointment type: ${appointmentType.id} - ${appointmentType.name}`);
    } else {
      console.log(`[getAppointmentType] No appointment type found with ID: ${id}${tenantId ? ` for tenant: ${tenantId}` : ''}`);
    }
    
    return appointmentType;
  }

  async getAppointmentTypes(tenantId?: number): Promise<AppointmentType[]> {
    try {
      if (tenantId) {
        console.log(`[getAppointmentTypes] Fetching appointment types for tenant ID: ${tenantId}`);
        
        // Direct tenant ID filter using our new tenantId column
        const directQuery = await db
          .select()
          .from(appointmentTypes)
          .where(eq(appointmentTypes.tenantId, tenantId));
          
        if (directQuery.length > 0) {
          console.log(`[getAppointmentTypes] Found ${directQuery.length} appointment types for tenant ID ${tenantId} using direct tenantId filter`);
          return directQuery;
        }
        
        // Fallback: filter appointment types by organization's facilities
        // This is for backward compatibility with appointment types created before the tenantId column
        console.log(`[getAppointmentTypes] No appointment types found with direct tenantId filter, using facility-based filter`);
        const query = `
          SELECT at.* FROM appointment_types at
          JOIN facilities f ON at.facility_id = f.id
          WHERE EXISTS (
            SELECT 1 FROM organization_facilities of 
            WHERE of.facility_id = f.id 
            AND of.organization_id = $1
          )
        `;
        
        const result = await pool.query(query, [tenantId]);
        console.log(`[getAppointmentTypes] Found ${result.rows.length} appointment types for tenant ID ${tenantId} using facility-based filter`);
        return result.rows;
      }
      
      // If no tenant ID is provided, return all appointment types (for super admin)
      const allTypes = await db.select().from(appointmentTypes);
      console.log(`[getAppointmentTypes] Returning all ${allTypes.length} appointment types (super admin)`);
      return allTypes;
    } catch (error) {
      console.error("Error in getAppointmentTypes:", error);
      throw error;
    }
  }

  async getAppointmentTypesByFacility(facilityId: number, tenantId?: number): Promise<AppointmentType[]> {
    // First get the facility to check its tenant
    let query = db
      .select()
      .from(appointmentTypes)
      .where(eq(appointmentTypes.facilityId, facilityId));
    
    // Add tenant filter if provided
    if (tenantId !== undefined) {
      query = query.where(eq(appointmentTypes.tenantId, tenantId));
    }
    
    const types = await query;
    console.log(`[getAppointmentTypesByFacility] Found ${types.length} appointment types for facility ${facilityId}${tenantId ? ` and tenant ${tenantId}` : ''}`);
    return types;
  }

  async createAppointmentType(appointmentType: InsertAppointmentType): Promise<AppointmentType> {
    const [newAppointmentType] = await db
      .insert(appointmentTypes)
      .values(appointmentType)
      .returning();
    return newAppointmentType;
  }

  async updateAppointmentType(id: number, appointmentTypeUpdate: Partial<AppointmentType>): Promise<AppointmentType | undefined> {
    const [updatedAppointmentType] = await db
      .update(appointmentTypes)
      .set({
        ...appointmentTypeUpdate,
        lastModifiedAt: new Date()
      })
      .where(eq(appointmentTypes.id, id))
      .returning();
    return updatedAppointmentType;
  }

  async deleteAppointmentType(id: number): Promise<boolean> {
    const result = await db
      .delete(appointmentTypes)
      .where(eq(appointmentTypes.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Daily Availability operations
  async getDailyAvailability(id: number): Promise<DailyAvailability | undefined> {
    const [availability] = await db
      .select()
      .from(dailyAvailability)
      .where(eq(dailyAvailability.id, id));
    return availability;
  }

  async getDailyAvailabilityByAppointmentType(appointmentTypeId: number): Promise<DailyAvailability[]> {
    return await db
      .select()
      .from(dailyAvailability)
      .where(eq(dailyAvailability.appointmentTypeId, appointmentTypeId));
  }

  async createDailyAvailability(availability: InsertDailyAvailability): Promise<DailyAvailability> {
    const [newAvailability] = await db
      .insert(dailyAvailability)
      .values(availability)
      .returning();
    return newAvailability;
  }

  async updateDailyAvailability(id: number, availabilityUpdate: Partial<DailyAvailability>): Promise<DailyAvailability | undefined> {
    const [updatedAvailability] = await db
      .update(dailyAvailability)
      .set(availabilityUpdate)
      .where(eq(dailyAvailability.id, id))
      .returning();
    return updatedAvailability;
  }

  async deleteDailyAvailability(id: number): Promise<boolean> {
    const result = await db
      .delete(dailyAvailability)
      .where(eq(dailyAvailability.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Custom Question operations
  async getCustomQuestion(id: number): Promise<CustomQuestion | undefined> {
    const [question] = await db
      .select()
      .from(customQuestions)
      .where(eq(customQuestions.id, id));
    return question;
  }

  async getCustomQuestionsByAppointmentType(appointmentTypeId: number): Promise<CustomQuestion[]> {
    return await db
      .select()
      .from(customQuestions)
      .where(eq(customQuestions.appointmentTypeId, appointmentTypeId));
  }

  async createCustomQuestion(question: InsertCustomQuestion): Promise<CustomQuestion> {
    const [newQuestion] = await db
      .insert(customQuestions)
      .values(question)
      .returning();
    return newQuestion;
  }

  async updateCustomQuestion(id: number, questionUpdate: Partial<CustomQuestion>): Promise<CustomQuestion | undefined> {
    const [updatedQuestion] = await db
      .update(customQuestions)
      .set({
        ...questionUpdate,
        lastModifiedAt: new Date()
      })
      .where(eq(customQuestions.id, id))
      .returning();
    return updatedQuestion;
  }

  async deleteCustomQuestion(id: number): Promise<boolean> {
    const result = await db
      .delete(customQuestions)
      .where(eq(customQuestions.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  // Booking Pages operations
  async getBookingPage(id: number, tenantId?: number): Promise<BookingPage | undefined> {
    try {
      let query = db
        .select()
        .from(bookingPages)
        .where(eq(bookingPages.id, id));
      
      // If tenantId is provided, add tenant filter
      if (tenantId !== undefined) {
        query = query.where(eq(bookingPages.tenantId, tenantId));
      }
      
      const [bookingPage] = await query;
      
      if (!bookingPage) {
        console.log(`No booking page found with ID ${id}${tenantId ? ` for tenant ${tenantId}` : ''}`);
        return undefined;
      }
      
      // Ensure facilities is always an array
      if (bookingPage.facilities) {
        try {
          // If it's a string (from JSONB column), parse it
          if (typeof bookingPage.facilities === 'string') {
            bookingPage.facilities = JSON.parse(bookingPage.facilities);
          }
          
          // Still ensure it's an array after parsing
          if (!Array.isArray(bookingPage.facilities)) {
            // If it's an object with keys as facility IDs, convert to array
            if (typeof bookingPage.facilities === 'object') {
              bookingPage.facilities = Object.keys(bookingPage.facilities).map(id => Number(id));
            } else {
              // Fallback to empty array if we can't parse it
              bookingPage.facilities = [];
            }
          }
        } catch (e) {
          console.error(`Error parsing facilities for booking page ${id}:`, e);
          bookingPage.facilities = [];
        }
      } else {
        bookingPage.facilities = [];
      }
      
      console.log(`[BookingPage] Successfully retrieved booking page: ${JSON.stringify({
        id: bookingPage.id,
        name: bookingPage.name,
        tenantId: bookingPage.tenantId,
        facilities: bookingPage.facilities ? 
          `[${bookingPage.facilities.length} facilities]` : 'none'
      })}`);
      
      // Log the actual facilities array for debugging
      console.log(`[BookingPage] Successfully retrieved booking page: ${JSON.stringify({
        id: bookingPage.id,
        name: bookingPage.name,
        facilities: bookingPage.facilities,
        excludedAppointmentTypes: bookingPage.excludedAppointmentTypes || []
      })}`);
      
      return bookingPage;
    } catch (error) {
      console.error(`Error retrieving booking page with ID ${id}:`, error);
      throw error;
    }
  }

  async getBookingPageBySlug(slug: string, tenantId?: number): Promise<BookingPage | undefined> {
    try {
      let query = db
        .select()
        .from(bookingPages)
        .where(eq(bookingPages.slug, slug));

      // If tenantId is provided, directly filter by tenant_id 
      if (tenantId !== undefined) {
        query = query.where(eq(bookingPages.tenantId, tenantId));
      }

      const [bookingPage] = await query;
      
      if (!bookingPage) {
        console.log(`No booking page found with slug ${slug}${tenantId ? ` for tenant ${tenantId}` : ''}`);
        return undefined;
      }
      
      // Ensure facilities is always an array (same logic as getBookingPage)
      if (bookingPage.facilities) {
        try {
          // If it's a string (from JSONB column), parse it
          if (typeof bookingPage.facilities === 'string') {
            bookingPage.facilities = JSON.parse(bookingPage.facilities);
          }
          
          // Still ensure it's an array after parsing
          if (!Array.isArray(bookingPage.facilities)) {
            // If it's an object with keys as facility IDs, convert to array
            if (typeof bookingPage.facilities === 'object') {
              bookingPage.facilities = Object.keys(bookingPage.facilities).map(id => Number(id));
            } else {
              // Fallback to empty array if we can't parse it
              bookingPage.facilities = [];
            }
          }
        } catch (e) {
          console.error(`Error parsing facilities for booking page with slug ${slug}:`, e);
          bookingPage.facilities = [];
        }
      } else {
        bookingPage.facilities = [];
      }
      
      console.log(`[BookingPage] Successfully retrieved booking page: ${JSON.stringify({
        id: bookingPage.id,
        name: bookingPage.name,
        slug: bookingPage.slug,
        tenantId: bookingPage.tenantId,
        facilities: bookingPage.facilities ? 
          `[${bookingPage.facilities.length} facilities]` : 'none'
      })}`);
      
      // Log the actual facilities array for debugging
      console.log(`[BookingPage] Successfully retrieved booking page: ${JSON.stringify({
        id: bookingPage.id,
        name: bookingPage.name,
        facilities: bookingPage.facilities,
        excludedAppointmentTypes: bookingPage.excludedAppointmentTypes || []
      })}`);
      
      return bookingPage;
    } catch (error) {
      console.error(`Error retrieving booking page by slug ${slug}:`, error);
      throw error;
    }
  }

  async getBookingPages(tenantId?: number): Promise<BookingPage[]> {
    try {
      let result: BookingPage[] = [];
      
      // If no tenantId is provided, return all booking pages (for super admin)
      if (tenantId === undefined) {
        result = await db.select().from(bookingPages);
        console.log(`Found ${result.length} booking pages (super admin view)`);
      } else {
        // With tenant_id column in place, we can directly filter by tenant
        result = await db
          .select()
          .from(bookingPages)
          .where(eq(bookingPages.tenantId, tenantId));
        
        console.log(`Found ${result.length} booking pages for organization ${tenantId} by tenantId`);
      }
      
      // Process each booking page to ensure facilities is always an array
      for (const bookingPage of result) {
        if (bookingPage.facilities) {
          try {
            // If it's a string (from JSONB column), parse it
            if (typeof bookingPage.facilities === 'string') {
              bookingPage.facilities = JSON.parse(bookingPage.facilities);
            }
            
            // Still ensure it's an array after parsing
            if (!Array.isArray(bookingPage.facilities)) {
              // If it's an object with keys as facility IDs, convert to array
              if (typeof bookingPage.facilities === 'object') {
                bookingPage.facilities = Object.keys(bookingPage.facilities).map(id => Number(id));
              } else {
                // Fallback to empty array if we can't parse it
                bookingPage.facilities = [];
              }
            }
          } catch (e) {
            console.error(`Error parsing facilities for booking page ${bookingPage.id}:`, e);
            bookingPage.facilities = [];
          }
        } else {
          bookingPage.facilities = [];
        }
      }
      
      return result;
    } catch (error) {
      console.error(`Error retrieving booking pages:`, error);
      throw error;
    }
  }

  async createBookingPage(insertBookingPage: InsertBookingPage): Promise<BookingPage> {
    // Get the creator's tenant ID if it's not already provided
    let tenantId = insertBookingPage.tenantId;
    if (!tenantId && insertBookingPage.createdBy) {
      const creator = await this.getUser(insertBookingPage.createdBy);
      tenantId = creator?.tenantId || null;
    }
    
    // Insert with tenant ID for proper isolation
    const [bookingPage] = await db
      .insert(bookingPages)
      .values({
        ...insertBookingPage,
        tenantId,
        lastModifiedAt: null,
        lastModifiedBy: insertBookingPage.createdBy
      })
      .returning();
    
    console.log(`Created booking page ${bookingPage.id} with tenant ID ${tenantId}`);
    
    return bookingPage;
  }

  async updateBookingPage(id: number, bookingPageUpdate: Partial<BookingPage>, tenantId?: number): Promise<BookingPage | undefined> {
    // First check if the booking page belongs to the tenant (if tenant ID is provided)
    if (tenantId !== undefined) {
      const existingBookingPage = await this.getBookingPage(id);
      if (!existingBookingPage || existingBookingPage.tenantId !== tenantId) {
        console.log(`Booking page ${id} does not belong to tenant ${tenantId} or does not exist`);
        return undefined;
      }
    }
    
    // Create a copy of the update object to modify
    const updateData = { ...bookingPageUpdate };
    
    // Don't allow changing the tenant ID during an update
    updateData.tenantId = undefined;
    
    // If facilities is provided, ensure it's in the correct format before saving
    if (updateData.facilities !== undefined) {
      try {
        // If it's already an array, we're good
        if (Array.isArray(updateData.facilities)) {
          // Make sure all elements are numbers
          updateData.facilities = updateData.facilities.map(id => 
            typeof id === 'string' ? Number(id) : id
          );
        } 
        // If it's a string (possibly from form data), try to parse it
        else if (typeof updateData.facilities === 'string') {
          try {
            const parsed = JSON.parse(updateData.facilities);
            if (Array.isArray(parsed)) {
              updateData.facilities = parsed.map(id => 
                typeof id === 'string' ? Number(id) : id
              );
            } else if (typeof parsed === 'object') {
              // Handle object format where keys are facility IDs
              updateData.facilities = Object.keys(parsed).map(id => Number(id));
            } else {
              // Default to empty array if we can't parse it properly
              updateData.facilities = [];
            }
          } catch (e) {
            console.error(`Error parsing facilities for booking page update ${id}:`, e);
            updateData.facilities = [];
          }
        }
        // If it's an object with facility IDs as keys
        else if (typeof updateData.facilities === 'object' && updateData.facilities !== null) {
          updateData.facilities = Object.keys(updateData.facilities).map(id => Number(id));
        }
        // Default to empty array for any other case
        else {
          updateData.facilities = [];
        }
        
        console.log(`Normalized facilities for booking page ${id} update:`, updateData.facilities);
      } catch (e) {
        console.error(`Error processing facilities for booking page update ${id}:`, e);
        updateData.facilities = [];
      }
    }
    
    // Perform the update
    const [updatedBookingPage] = await db
      .update(bookingPages)
      .set({
        ...updateData,
        lastModifiedAt: new Date()
      })
      .where(eq(bookingPages.id, id))
      .returning();
      
    // Always ensure the facilities property is normalized in the returned object
    if (updatedBookingPage.facilities) {
      try {
        // If it's a string (from JSONB column), parse it
        if (typeof updatedBookingPage.facilities === 'string') {
          updatedBookingPage.facilities = JSON.parse(updatedBookingPage.facilities);
        }
        
        // Still ensure it's an array after parsing
        if (!Array.isArray(updatedBookingPage.facilities)) {
          // If it's an object with keys as facility IDs, convert to array
          if (typeof updatedBookingPage.facilities === 'object') {
            updatedBookingPage.facilities = Object.keys(updatedBookingPage.facilities).map(id => Number(id));
          } else {
            // Fallback to empty array if we can't parse it
            updatedBookingPage.facilities = [];
          }
        }
      } catch (e) {
        console.error(`Error parsing facilities for updated booking page ${id}:`, e);
        updatedBookingPage.facilities = [];
      }
    } else {
      updatedBookingPage.facilities = [];
    }
      
    console.log(`Updated booking page ${id} (tenant ${updatedBookingPage.tenantId})`);
    return updatedBookingPage;
  }

  async deleteBookingPage(id: number, tenantId?: number): Promise<boolean> {
    // Apply tenant isolation if tenant ID is provided
    if (tenantId !== undefined) {
      const existingBookingPage = await this.getBookingPage(id);
      if (!existingBookingPage || existingBookingPage.tenantId !== tenantId) {
        console.log(`Cannot delete booking page ${id} - it doesn't belong to tenant ${tenantId} or doesn't exist`);
        return false;
      }
    }
    
    // Proceed with deletion
    const result = await db
      .delete(bookingPages)
      .where(eq(bookingPages.id, id));
      
    const success = result.rowCount ? result.rowCount > 0 : false;
    if (success) {
      console.log(`Successfully deleted booking page ${id}`);
    } else {
      console.log(`Failed to delete booking page ${id}`);
    }
    
    return success;
  }
}

// Initialize database
export async function initializeDatabase() {
  const dbStorage = new DatabaseStorage();
  
  // Check if we need to seed initial data
  const existingUsers = await dbStorage.getUsers();
  if (existingUsers.length === 0) {
    console.log("Seeding initial database data...");
    
    // Create default admin user
    await dbStorage.createUser({
      username: "admin",
      password: "$2b$10$NrM4S5VFRWKxIFBdSvGQVObcUQZrsquxA3KH9RBKuHKpHHFQXsNGe", // "admin123"
      email: "admin@example.com",
      firstName: "Admin",
      lastName: "User",
      role: "admin",
    });
    
    // Create test manager
    await dbStorage.createUser({
      username: "manager",
      password: "$2b$10$NrM4S5VFRWKxIFBdSvGQVObcUQZrsquxA3KH9RBKuHKpHHFQXsNGe", // "admin123"
      email: "manager@example.com",
      firstName: "Manager",
      lastName: "User",
      role: "manager",
    });
    
    // Create testadmin user for testing with plain password
    const hashedPasswordAdmin = await hashPassword("password123");
    await dbStorage.createUser({
      username: "testadmin",
      password: hashedPasswordAdmin, 
      email: "testadmin@example.com",
      firstName: "Test",
      lastName: "Admin",
      role: "admin",
    });
    
    // Create test dock worker with plain password
    const hashedPasswordWorker = await hashPassword("admin123");
    await dbStorage.createUser({
      username: "worker",
      password: hashedPasswordWorker,
      email: "worker@example.com",
      firstName: "Dock",
      lastName: "Worker",
      role: "worker",
    });
    
    // Create a default facility
    const mainFacility = await dbStorage.createFacility({
      name: "Main Warehouse",
      address1: "123 Logistics Way",
      address2: "Building A",
      city: "Indianapolis",
      state: "IN",
      pincode: "46201",
      country: "USA",
      latitude: "39.768403",
      longitude: "-86.158068",
      company: "Hanzo Logistics"
    });
    
    // Create some docks
    const dockNames = ["A-01", "A-02", "A-03", "A-04", "B-01", "B-02", "B-03", "B-04"];
    for (const name of dockNames) {
      await dbStorage.createDock({
        name,
        facilityId: mainFacility.id, // Associate with the main facility
        isActive: true,
        type: "both",
        constraints: { maxTrailerLength: 53, requiresForklift: false }
      });
    }
    
    // Create some carriers
    const carrierNames = ["FedEx", "UPS", "DHL Express", "USPS", "Amazon Logistics", "Swift", "JB Hunt", "YRC"];
    for (const name of carrierNames) {
      await dbStorage.createCarrier({
        name,
        contactName: `${name} Contact`,
        contactEmail: `contact@${name.toLowerCase().replace(/\s+/g, '')}.com`,
        contactPhone: "555-123-4567"
      });
    }
    
    // Create default appointment settings for the main facility
    await dbStorage.createAppointmentSettings({
      facilityId: mainFacility.id,
      timeInterval: TimeInterval.MINUTES_30,
      maxConcurrentInbound: 3,
      maxConcurrentOutbound: 2,
      shareAvailabilityInfo: true,
    });
    
    console.log("Database seeding completed.");
  }
  
  return dbStorage;
}

// Use database storage
let storage: IStorage;

export async function getStorage(): Promise<IStorage> {
  if (!storage) {
    // Use database storage
    try {
      storage = await initializeDatabase();
      console.log("Using PostgreSQL database storage");
    } catch (error) {
      console.error("Error initializing database storage:", error);
      console.log("Falling back to in-memory storage");
      storage = new MemStorage();
    }
  }
  return storage;
}
