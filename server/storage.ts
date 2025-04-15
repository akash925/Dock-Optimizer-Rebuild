import { 
  User, InsertUser, 
  Dock, InsertDock, 
  Schedule, InsertSchedule, 
  Carrier, InsertCarrier, 
  Notification, InsertNotification, 
  ScheduleStatus, DockStatus
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

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
  
  // Notification operations
  getNotification(id: number): Promise<Notification | undefined>;
  getNotificationsByUser(userId: number): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: number): Promise<Notification | undefined>;
  
  // Session store
  sessionStore: session.SessionStore;
}

// In-Memory Storage Implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private docks: Map<number, Dock>;
  private schedules: Map<number, Schedule>;
  private carriers: Map<number, Carrier>;
  private notifications: Map<number, Notification>;
  sessionStore: session.SessionStore;
  
  private userIdCounter: number = 1;
  private dockIdCounter: number = 1;
  private scheduleIdCounter: number = 1;
  private carrierIdCounter: number = 1;
  private notificationIdCounter: number = 1;

  constructor() {
    this.users = new Map();
    this.docks = new Map();
    this.schedules = new Map();
    this.carriers = new Map();
    this.notifications = new Map();
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
    
    // Create some docks
    const dockNames = ["A-01", "A-02", "A-03", "A-04", "B-01", "B-02", "B-03", "B-04"];
    dockNames.forEach(name => {
      this.createDock({
        name,
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
    const schedule: Schedule = { 
      ...insertSchedule, 
      id, 
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
}

export const storage = new MemStorage();
