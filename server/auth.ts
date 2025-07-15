import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import session from "express-session";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users } from "@shared/schema";
import { getUserByUsername, validatePassword } from "./storage/users";
import { getTenantIdForUser } from "./storage/tenants";
import { getModulesForOrganization } from "./storage/modules";
import { setTenantSearchPath, resetSearchPath } from "./utils/setTenantSearchPath";


passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const user = await getUserByUsername(username);
      if (!user) return done(null, false, { message: "Incorrect username." });

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return done(null, false, { message: "Incorrect password." });

      // Get tenant ID for the user
      const tenantId = await getTenantIdForUser(user.id);
      
      // Set search path for tenant isolation
      if (tenantId) {
        try {
          await setTenantSearchPath(tenantId);
        } catch (searchPathError) {
          console.error(`[Auth] Failed to set search path for tenant ${tenantId} during login:`, searchPathError);
          return done(new Error(`Authentication failed: Could not establish tenant context`));
        }
      } else {
        // Reset to public schema if no tenant
        try {
          await resetSearchPath();
        } catch (resetError) {
          console.error(`[Auth] Failed to reset search path during login:`, resetError);
        }
      }

      // Transform user data to match Express user type
      const authUser = {
        ...user,
        tenantId: tenantId || undefined
      };

      return done(null, authUser);
    } catch (err) {
      return done(err);
    }
  })
);

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: number, done) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    if (!user) return done(null, false);

    const tenantId = await getTenantIdForUser(user.id);
    
    // Set search path for tenant isolation on every request
    if (tenantId) {
      try {
        await setTenantSearchPath(tenantId);
      } catch (searchPathError) {
        console.error(`[Auth] Failed to set search path for tenant ${tenantId} during session restoration:`, searchPathError);
        // Continue with authentication but log the critical error
        console.error(`[Auth] CRITICAL: Tenant isolation may be compromised for user ${user.id}`);
      }
    } else {
      // Reset to public schema if no tenant
      try {
        await resetSearchPath();
      } catch (resetError) {
        console.error(`[Auth] Failed to reset search path during session restoration:`, resetError);
      }
    }
    
    const modules = await getModulesForOrganization(tenantId || 0);

    const authUser = {
      ...user,
      tenantId: tenantId || undefined,
      modules: modules || []
    };

    done(null, authUser);
  } catch (err) {
    done(err);
  }
});

export function setupAuth(app: any) {
  // Configure session middleware
  app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true in production with HTTPS
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));
  
  app.use(passport.initialize());
  app.use(passport.session());

  // Login route
  app.post('/api/login', (req: any, res: any, next: any) => {
    passport.authenticate('local', (err: any, user: any, info: any) => {
      if (err) {
        console.error('Login error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      req.logIn(user, (err: any) => {
        if (err) {
          console.error('Session error:', err);
          return res.status(500).json({ error: 'Session error' });
        }
        
        // Return user data as JSON
        return res.json({
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          tenantId: user.tenantId,
          modules: user.modules || []
        });
      });
    })(req, res, next);
  });

  // Logout route
  app.post('/api/logout', (req: any, res: any) => {
    req.logout((err: any) => {
      if (err) {
        return res.status(500).json({ error: 'Logout failed' });
      }
      res.json({ message: 'Logged out successfully' });
    });
  });

  // Get current user route
  app.get('/api/user', (req: any, res: any) => {
    if (req.isAuthenticated()) {
      res.json({
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        role: req.user.role,
        tenantId: req.user.tenantId,
        modules: req.user.modules || []
      });
    } else {
      res.status(401).json({ error: 'Not authenticated' });
    }
  });
}
