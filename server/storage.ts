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
  ScheduleStatus, DockStatus, HolidayScope, TimeInterval,
  users, docks, schedules, carriers, notifications, facilities, holidays, appointmentSettings,
  appointmentTypes, dailyAvailability, customQuestions, bookingPages, assets
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPg from "connect-pg-simple";
import { eq, and, gte, lte } from "drizzle-orm";
import { db, pool } from "./db";

const MemoryStore = createMemoryStore(session);
const PostgresSessionStore = connectPg(session);

// Storage Interface
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsers(): Promise<User[]>;
  
  // Dock operations
  getDock(id: number): Promise<Dock | undefined>;
  getDocks(): Promise<Dock[]>;
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
  getFacilities(): Promise<Facility[]>;
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
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // 24 hours
    });
    
    // Setup initial data
    this.setupInitialData();
  }

  private setupInitialData() {
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
    
    // Create test dock worker
    this.createUser({
      username: "worker",
      password: "$2b$10$NrM4S5VFRWKxIFBdSvGQVObcUQZrsquxA3KH9RBKuHKpHHFQXsNGe", // "admin123"
      email: "worker@example.com",
      firstName: "Dock",
      lastName: "Worker",
      role: "worker",
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
  
  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  // Dock operations
  async getDock(id: number): Promise<Dock | undefined> {
    return this.docks.get(id);
  }

  async getDocks(): Promise<Dock[]> {
    return Array.from(this.docks.values());
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

  async getFacilities(): Promise<Facility[]> {
    return Array.from(this.facilities.values());
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
  
  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
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
      // Use pool's query directly to avoid any issues with the ORM
      const result = await pool.query(
        `SELECT * FROM schedules WHERE id = $1 LIMIT 1`,
        [id]
      );
      
      if (result.rows.length === 0) {
        return undefined;
      }
      
      const row = result.rows[0];
      
      // Convert snake_case database columns to camelCase for our interface
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

  async getSchedules(): Promise<Schedule[]> {
    try {
      // Use pool to query directly
      const result = await pool.query(`SELECT * FROM schedules`);
      
      // Transform to match our expected Schedule interface
      return result.rows.map((row: any) => {
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
      // Use pool to query directly
      const result = await pool.query(
        `SELECT * FROM schedules WHERE dock_id = $1`,
        [dockId]
      );
      
      // Transform to match our expected Schedule interface
      return result.rows.map((row: any) => {
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

  async getSchedulesByDateRange(startDate: Date, endDate: Date): Promise<Schedule[]> {
    try {
      // Use pool to query directly - join with facilities to get better data
      const result = await pool.query(`
        SELECT s.*, d.name as dock_name, f.name as facility_name, f.id as facility_id, 
               at.name as appointment_type_name
        FROM schedules s
        LEFT JOIN docks d ON s.dock_id = d.id
        LEFT JOIN facilities f ON d.facility_id = f.id
        LEFT JOIN appointment_types at ON s.appointment_type_id = at.id
        WHERE s.start_time >= $1 AND s.end_time <= $2
      `, [startDate, endDate]);
      
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
      
      const values = {
        dock_id: insertSchedule.dockId,
        carrier_id: insertSchedule.carrierId,
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
        custom_form_data: insertSchedule.customFormData || null,
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
      if ('carrierId' in updateWithoutAppointmentTypeId) updateFields.carrier_id = updateWithoutAppointmentTypeId.carrierId;
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
  async getFacility(id: number): Promise<Facility | undefined> {
    const [facility] = await db.select().from(facilities).where(eq(facilities.id, id));
    return facility;
  }

  async getFacilities(): Promise<Facility[]> {
    return await db.select().from(facilities);
  }

  async createFacility(insertFacility: InsertFacility): Promise<Facility> {
    const [facility] = await db.insert(facilities).values(insertFacility).returning();
    return facility;
  }

  async updateFacility(id: number, facilityUpdate: Partial<Facility>): Promise<Facility | undefined> {
    const [updatedFacility] = await db
      .update(facilities)
      .set({
        ...facilityUpdate,
        lastModifiedAt: new Date()
      })
      .where(eq(facilities.id, id))
      .returning();
    return updatedFacility;
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
  async getAppointmentType(id: number): Promise<AppointmentType | undefined> {
    const [appointmentType] = await db
      .select()
      .from(appointmentTypes)
      .where(eq(appointmentTypes.id, id));
    return appointmentType;
  }

  async getAppointmentTypes(): Promise<AppointmentType[]> {
    return await db.select().from(appointmentTypes);
  }

  async getAppointmentTypesByFacility(facilityId: number): Promise<AppointmentType[]> {
    return await db
      .select()
      .from(appointmentTypes)
      .where(eq(appointmentTypes.facilityId, facilityId));
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
  async getBookingPage(id: number): Promise<BookingPage | undefined> {
    const [bookingPage] = await db
      .select()
      .from(bookingPages)
      .where(eq(bookingPages.id, id));
    return bookingPage;
  }

  async getBookingPageBySlug(slug: string): Promise<BookingPage | undefined> {
    const [bookingPage] = await db
      .select()
      .from(bookingPages)
      .where(eq(bookingPages.slug, slug));
    return bookingPage;
  }

  async getBookingPages(): Promise<BookingPage[]> {
    return await db.select().from(bookingPages);
  }

  async createBookingPage(insertBookingPage: InsertBookingPage): Promise<BookingPage> {
    const [bookingPage] = await db
      .insert(bookingPages)
      .values({
        ...insertBookingPage,
        lastModifiedAt: null,
        lastModifiedBy: insertBookingPage.createdBy
      })
      .returning();
    return bookingPage;
  }

  async updateBookingPage(id: number, bookingPageUpdate: Partial<BookingPage>): Promise<BookingPage | undefined> {
    const [updatedBookingPage] = await db
      .update(bookingPages)
      .set({
        ...bookingPageUpdate,
        lastModifiedAt: new Date()
      })
      .where(eq(bookingPages.id, id))
      .returning();
    return updatedBookingPage;
  }

  async deleteBookingPage(id: number): Promise<boolean> {
    const result = await db
      .delete(bookingPages)
      .where(eq(bookingPages.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
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
    
    // Create test dock worker
    await dbStorage.createUser({
      username: "worker",
      password: "$2b$10$NrM4S5VFRWKxIFBdSvGQVObcUQZrsquxA3KH9RBKuHKpHHFQXsNGe", // "admin123"
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
