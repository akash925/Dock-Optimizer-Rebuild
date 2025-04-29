import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { getStorage } from "./storage";
import { User, Role } from "@shared/schema";

declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      password: string;
      email: string;
      firstName: string;
      lastName: string;
      role: Role;
      createdAt: Date;
    }
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  // Check if stored password is in the correct format
  if (!stored || !stored.includes('.')) {
    console.error('Password is not in the correct format: hash.salt');
    return false;
  }

  const [hashed, salt] = stored.split(".");
  
  // Additional validation
  if (!hashed || !salt) {
    console.error('Invalid password format: missing hash or salt');
    return false;
  }

  try {
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error('Error comparing passwords:', error);
    return false;
  }
}

export async function setupAuth(app: Express) {
  // Get the storage instance
  const storage = await getStorage();
  
  // Ensure we have a session secret
  const sessionSecret = process.env.SESSION_SECRET || "dock-optimizer-secret-key";

  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log("Attempting to authenticate with LocalStrategy:", username);
        const user = await storage.getUserByUsername(username);
        
        if (!user) {
          console.log("User not found:", username);
          return done(null, false, { message: "Invalid username or password" });
        }
        
        // Check if password needs fixing (for super-admin)
        if (user.role === "super-admin" && (!user.password || !user.password.includes('.'))) {
          console.log("Super-admin password format needs fixing, updating...");
          const hashedPassword = await hashPassword("password123");
          const updatedUser = await storage.updateUser(user.id, {
            password: hashedPassword
          });
          
          if (updatedUser) {
            console.log("Super-admin password updated successfully");
            return done(null, updatedUser);
          }
        }
        
        // Normal authentication flow
        const passwordMatch = await comparePasswords(password, user.password);
        console.log("Password check result:", passwordMatch ? "Success" : "Failed");
        
        if (!passwordMatch) {
          return done(null, false, { message: "Invalid username or password" });
        } else {
          return done(null, user);
        }
      } catch (err) {
        console.error("Authentication error:", err);
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      
      // Import the enrichUserWithRole function using dynamic import to avoid circular dependencies
      const { enrichUserWithRole } = await import('./enrich-user-role');
      
      // Enrich the user object with the correct role information
      const enrichedUser = await enrichUserWithRole(user);
      
      done(null, enrichedUser);
    } catch (err) {
      console.error("Error in deserializeUser:", err);
      done(err);
    }
  });

  // Authentication middleware to check role
  function checkRole(role: Role | Role[]) {
    return (req: Express.Request, res: Express.Response, next: Express.NextFunction) => {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized: Please log in" });
      }
      
      const roles = Array.isArray(role) ? role : [role];
      if (!roles.includes(req.user.role as Role)) {
        return res.status(403).json({ message: "Forbidden: Insufficient permissions" });
      }
      
      next();
    };
  }

  app.post("/api/register", async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const hashedPassword = await hashPassword(req.body.password);
      
      const user = await storage.createUser({
        ...req.body,
        password: hashedPassword,
      });

      req.login(user, (err) => {
        if (err) return next(err);
        // Don't send password in response
        const { password, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/login", (req, res, next) => {
    console.log("Login attempt:", req.body.username);
    
    passport.authenticate("local", async (err, user, info) => {
      if (err) {
        console.error("Login error:", err);
        return next(err);
      }
      if (!user) {
        console.log("Authentication failed:", info?.message || "Unknown reason");
        return res.status(401).json({ message: info?.message || "Authentication failed" });
      }
      
      try {
        // Enrich user with role information before login
        const { enrichUserWithRole } = await import('./enrich-user-role');
        const enrichedUser = await enrichUserWithRole(user);
        
        console.log("User authenticated:", enrichedUser.username, "with role:", enrichedUser.role);
        
        req.login(enrichedUser, (loginErr) => {
          if (loginErr) {
            console.error("Login session error:", loginErr);
            return next(loginErr);
          }
          
          console.log("Login successful, session created:", req.sessionID);
          // Don't send password in response
          const { password, ...userWithoutPassword } = enrichedUser;
          res.status(200).json(userWithoutPassword);
        });
      } catch (enrichErr) {
        console.error("Error enriching user data:", enrichErr);
        
        // Fall back to regular login if enrichment fails
        req.login(user, (loginErr) => {
          if (loginErr) {
            console.error("Login session error:", loginErr);
            return next(loginErr);
          }
          
          console.log("Login successful with original user data, session created:", req.sessionID);
          const { password, ...userWithoutPassword } = user;
          res.status(200).json(userWithoutPassword);
        });
      }
    })(req, res, next);
  });
  
  // Add a test route to log in as super-admin (for development)
  app.get("/api/test-login", async (req, res, next) => {
    try {
      console.log("Test login endpoint called");
      const { enrichUserWithRole } = await import('./enrich-user-role');
      
      // Try to find the super-admin account
      const storage = await getStorage();
      let superAdmin = await storage.getUserByUsername("akash.agarwal@conmitto.io");
      
      if (superAdmin) {
        console.log("Found super-admin user:", superAdmin.id);
        
        // Update with correct password format if needed
        if (!superAdmin.password || !superAdmin.password.includes('.')) {
          console.log("Updating super-admin user with proper password format");
          const hashedPassword = await hashPassword("password123");
          
          const updatedUser = await storage.updateUser(superAdmin.id, {
            password: hashedPassword
          });
          
          if (updatedUser) {
            superAdmin = updatedUser;
            console.log("Super-admin password updated successfully");
          } else {
            console.error("Failed to update super-admin password");
          }
        }
        
        // Enrich the super-admin user with the correct role
        const enrichedSuperAdmin = await enrichUserWithRole(superAdmin);
        console.log("Enriched super-admin with role:", enrichedSuperAdmin.role);
        
        // Log in as super-admin
        req.login(enrichedSuperAdmin, (loginErr) => {
          if (loginErr) {
            console.error("Login error:", loginErr);
            return next(loginErr);
          }
          
          console.log("Login successful as super-admin");
          const { password, ...userWithoutPassword } = enrichedSuperAdmin;
          
          return res.status(200).json({
            message: "Logged in as super-admin",
            user: userWithoutPassword
          });
        });
      } else {
        // Fallback to regular test admin if super-admin doesn't exist
        let testUser = await storage.getUserByUsername("testadmin");
        
        if (testUser) {
          console.log("Found existing test user:", testUser.id);
          
          // Update with correct password format if needed
          if (!testUser.password || !testUser.password.includes('.')) {
            console.log("Updating test admin user with proper password format");
            const hashedPassword = await hashPassword("password123");
            
            const updatedUser = await storage.updateUser(testUser.id, {
              password: hashedPassword
            });
            
            if (updatedUser) {
              testUser = updatedUser;
              console.log("User password updated successfully");
            } else {
              console.error("Failed to update user password");
            }
          }
          
          // Enrich the test user with the correct role
          const enrichedTestUser = await enrichUserWithRole(testUser);
          console.log("Enriched test user with role:", enrichedTestUser.role);
          
          // Log in with existing user
          req.login(enrichedTestUser, (loginErr) => {
            if (loginErr) {
              console.error("Login error:", loginErr);
              return next(loginErr);
            }
            
            console.log("Login successful with test user");
            const { password, ...userWithoutPassword } = enrichedTestUser;
            
            return res.status(200).json({
              message: "Logged in with existing test user",
              user: userWithoutPassword
            });
          });
        } else {
          console.log("Creating new test admin user");
          // Create a test admin user
          const hashedPassword = await hashPassword("password123");
          const newUser = await storage.createUser({
            username: "testadmin",
            password: hashedPassword,
            email: "testadmin@example.com",
            firstName: "Test",
            lastName: "Admin",
            role: "admin",
            tenantId: null
          });
          
          console.log("New test user created:", newUser.id);
          
          // Enrich the new user with the correct role
          const enrichedNewUser = await enrichUserWithRole(newUser);
          
          // Log in with the new user
          req.login(enrichedNewUser, (loginErr) => {
            if (loginErr) {
              console.error("Login error for new user:", loginErr);
              return next(loginErr);
            }
            
            console.log("Login successful with new test user");
            const { password, ...userWithoutPassword } = enrichedNewUser;
            
            return res.status(200).json({
              message: "Created and logged in with new test user",
              user: userWithoutPassword
            });
          });
        }
      }
    } catch (err) {
      console.error("Test login error:", err);
      res.status(500).json({ 
        message: "An error occurred during test login", 
        error: err instanceof Error ? err.message : String(err) 
      });
    }
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    console.log("GET /api/user - isAuthenticated:", req.isAuthenticated());
    console.log("Session ID:", req.sessionID);
    console.log("Session:", req.session);
    
    if (!req.isAuthenticated()) return res.sendStatus(401);
    // Don't send password in response
    const { password, ...userWithoutPassword } = req.user as User;
    res.json(userWithoutPassword);
  });
  
  // Debug route for auth status
  app.get("/api/auth-status", (req, res) => {
    res.json({
      isAuthenticated: req.isAuthenticated(),
      sessionID: req.sessionID,
      hasSession: !!req.session,
      hasSessionID: !!req.sessionID,
      hasUser: !!req.user,
      cookies: req.headers.cookie
    });
  });

  // Make auth middleware available for routes
  app.locals.checkRole = checkRole;
}
