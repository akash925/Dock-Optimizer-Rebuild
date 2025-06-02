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
}
