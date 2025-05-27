import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import { getUserByUsername, getTenantIdForUser, getModulesForUser } from "./storage";

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
    const modules = await getModulesForUser(user.id);

    user.tenantId = tenantId;
    user.modules = modules;
    user.role = user.role || "user";

    done(null, user);
  } catch (err) {
    done(err);
  }
});
