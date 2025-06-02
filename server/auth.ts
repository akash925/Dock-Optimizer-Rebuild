import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import session from "express-session";
import { getUserByUsername, validatePassword } from "./storage/users";
import { getTenantIdForUser } from "./storage/tenants";
import { getModulesForOrganization } from "./storage/modules";
import { getStorage } from "./storage";


passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const user = await getUserByUsername(username);
      if (!user) return done(null, false, { message: "Incorrect username." });

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return done(null, false, { message: "Incorrect password." });

      return done(null, user);
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
    const user = await getUserByUsername(id.toString());
    if (!user) return done(null, false);

    const tenantId = await getTenantIdForUser(user.id);
    const modules = await getModulesForOrganization(tenantId || 0);

    (user as any).tenantId = tenantId;
    (user as any).modules = modules;
    user.role = user.role || "user";

    done(null, user);
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
