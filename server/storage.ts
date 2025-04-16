import { 
  User, InsertUser, 
  Dock, InsertDock, 
  Schedule, InsertSchedule, 
  Carrier, InsertCarrier, 
  Notification, InsertNotification,
  Facility, InsertFacility,
  Holiday, InsertHoliday,
  AppointmentSettings, InsertAppointmentSettings,
  ScheduleStatus, DockStatus, HolidayScope, TimeInterval,
  users, docks, schedules, carriers, notifications, facilities, holidays, appointmentSettings
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
  createSchedule(schedule: InsertSchedule): Promise<Schedule>;
  updateSchedule(id: number, schedule: Partial<Schedule>): Promise<Schedule | undefined>;
  deleteSchedule(id: number): Promise<boolean>;
  
  // Carrier operations
  getCarrier(id: number): Promise<Carrier | undefined>;
  getCarriers(): Promise<Carrier[]>;
  createCarrier(carrier: InsertCarrier): Promise<Carrier>;
  
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
  sessionStore: any;
  
  private userIdCounter: number = 1;
  private dockIdCounter: number = 1;
  private scheduleIdCounter: number = 1;
  private carrierIdCounter: number = 1;
  private facilityIdCounter: number = 1;
  private notificationIdCounter: number = 1;
  private appointmentSettingsIdCounter: number = 1;

  constructor() {
    this.users = new Map();
    this.docks = new Map();
    this.schedules = new Map();
    this.carriers = new Map();
    this.facilities = new Map();
    this.notifications = new Map();
    this.appointmentSettings = new Map();
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
    const carrier: Carrier = { ...insertCarrier, id };
    this.carriers.set(id, carrier);
    return carrier;
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
}

// Database Storage Implementation
export class DatabaseStorage implements IStorage {
  sessionStore: session.SessionStore;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true
    });
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
      const result = await db.execute(`
        SELECT 
          id, type, status, dock_id as "dockId", carrier_id as "carrierId", 
          truck_number as "truckNumber", start_time as "startTime", end_time as "endTime", 
          created_at as "createdAt", created_by as "createdBy", 
          last_modified_at as "lastModifiedAt", last_modified_by as "lastModifiedBy",
          notes
        FROM schedules
        WHERE id = $1
      `, [id]);
      
      if (result.rows.length === 0) {
        return undefined;
      }
      
      const row = result.rows[0];
      return {
        id: row.id,
        type: row.type,
        status: row.status,
        dockId: row.dockId,
        carrierId: row.carrierId,
        truckNumber: row.truckNumber,
        trailerNumber: null,
        driverName: null,
        driverPhone: null,
        bolNumber: null,
        poNumber: null,
        palletCount: null,
        weight: null,
        appointmentMode: "trailer",
        startTime: row.startTime,
        endTime: row.endTime,
        createdAt: row.createdAt,
        createdBy: row.createdBy,
        lastModifiedAt: row.lastModifiedAt,
        lastModifiedBy: row.lastModifiedBy,
        notes: row.notes
      };
    } catch (error) {
      console.error("Error executing getSchedule:", error);
      throw error;
    }
  }

  async getSchedules(): Promise<Schedule[]> {
    try {
      // Use raw SQL to handle potential schema differences
      const result = await db.execute(`
        SELECT 
          id, type, status, dock_id as "dockId", carrier_id as "carrierId", 
          truck_number as "truckNumber", start_time as "startTime", end_time as "endTime", 
          created_at as "createdAt", created_by as "createdBy", 
          last_modified_at as "lastModifiedAt", last_modified_by as "lastModifiedBy",
          notes
        FROM schedules
      `);
      
      // Transform to match our expected Schedule interface
      return result.rows.map((row: any) => {
        return {
          id: row.id,
          type: row.type,
          status: row.status,
          dockId: row.dockId,
          carrierId: row.carrierId,
          truckNumber: row.truckNumber,
          trailerNumber: null,
          driverName: null,
          driverPhone: null,
          bolNumber: null,
          poNumber: null,
          palletCount: null,
          weight: null,
          appointmentMode: "trailer",
          startTime: row.startTime,
          endTime: row.endTime,
          createdAt: row.createdAt,
          createdBy: row.createdBy,
          lastModifiedAt: row.lastModifiedAt,
          lastModifiedBy: row.lastModifiedBy,
          notes: row.notes
        };
      });
    } catch (error) {
      console.error("Error executing getSchedules:", error);
      throw error;
    }
  }

  async getSchedulesByDock(dockId: number): Promise<Schedule[]> {
    try {
      const result = await db.execute(`
        SELECT 
          id, type, status, dock_id as "dockId", carrier_id as "carrierId", 
          truck_number as "truckNumber", start_time as "startTime", end_time as "endTime", 
          created_at as "createdAt", created_by as "createdBy", 
          last_modified_at as "lastModifiedAt", last_modified_by as "lastModifiedBy",
          notes
        FROM schedules
        WHERE dock_id = $1
      `, [dockId]);
      
      return result.rows.map((row: any) => {
        return {
          id: row.id,
          type: row.type,
          status: row.status,
          dockId: row.dockId,
          carrierId: row.carrierId,
          truckNumber: row.truckNumber,
          trailerNumber: null,
          driverName: null,
          driverPhone: null,
          bolNumber: null,
          poNumber: null,
          palletCount: null,
          weight: null,
          appointmentMode: "trailer",
          startTime: row.startTime,
          endTime: row.endTime,
          createdAt: row.createdAt,
          createdBy: row.createdBy,
          lastModifiedAt: row.lastModifiedAt,
          lastModifiedBy: row.lastModifiedBy,
          notes: row.notes
        };
      });
    } catch (error) {
      console.error("Error executing getSchedulesByDock:", error);
      throw error;
    }
  }

  async getSchedulesByDateRange(startDate: Date, endDate: Date): Promise<Schedule[]> {
    try {
      const result = await db.execute(`
        SELECT 
          id, type, status, dock_id as "dockId", carrier_id as "carrierId", 
          truck_number as "truckNumber", start_time as "startTime", end_time as "endTime", 
          created_at as "createdAt", created_by as "createdBy", 
          last_modified_at as "lastModifiedAt", last_modified_by as "lastModifiedBy",
          notes
        FROM schedules
        WHERE start_time >= $1 AND end_time <= $2
      `, [startDate, endDate]);
      
      return result.rows.map((row: any) => {
        return {
          id: row.id,
          type: row.type,
          status: row.status,
          dockId: row.dockId,
          carrierId: row.carrierId,
          truckNumber: row.truckNumber,
          trailerNumber: null,
          driverName: null,
          driverPhone: null,
          bolNumber: null,
          poNumber: null,
          palletCount: null,
          weight: null,
          appointmentMode: "trailer",
          startTime: row.startTime,
          endTime: row.endTime,
          createdAt: row.createdAt,
          createdBy: row.createdBy,
          lastModifiedAt: row.lastModifiedAt,
          lastModifiedBy: row.lastModifiedBy,
          notes: row.notes
        };
      });
    } catch (error) {
      console.error("Error executing getSchedulesByDateRange:", error);
      throw error;
    }
  }

  async createSchedule(insertSchedule: InsertSchedule): Promise<Schedule> {
    const [schedule] = await db
      .insert(schedules)
      .values({
        ...insertSchedule,
        trailerNumber: insertSchedule.trailerNumber || null,
        driverName: insertSchedule.driverName || null,
        driverPhone: insertSchedule.driverPhone || null,
        bolNumber: insertSchedule.bolNumber || null,
        poNumber: insertSchedule.poNumber || null,
        palletCount: insertSchedule.palletCount || null,
        weight: insertSchedule.weight || null,
        appointmentMode: insertSchedule.appointmentMode || "trailer",
        lastModifiedAt: new Date(),
        lastModifiedBy: insertSchedule.createdBy
      })
      .returning();
    return schedule;
  }

  async updateSchedule(id: number, scheduleUpdate: Partial<Schedule>): Promise<Schedule | undefined> {
    const [updatedSchedule] = await db
      .update(schedules)
      .set({
        ...scheduleUpdate,
        lastModifiedAt: new Date()
      })
      .where(eq(schedules.id, id))
      .returning();
    return updatedSchedule;
  }

  async deleteSchedule(id: number): Promise<boolean> {
    const result = await db
      .delete(schedules)
      .where(eq(schedules.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
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
    const [settings] = await db
      .select()
      .from(appointmentSettings)
      .where(eq(appointmentSettings.facilityId, facilityId));
    return settings;
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
