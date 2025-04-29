import express from "express";
import { getStorage } from "../../../storage";
import { db } from "../../../db";
import { eq } from "drizzle-orm";
import { users, organizationUsers, roles } from "@shared/schema";
import { organizations } from "@shared/schema";

const router = express.Router();

// Middleware to check if user is a super-admin
const requireSuperAdmin = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (req.user?.role !== "super-admin") {
    return res.status(403).json({ message: "Access denied. Super admin role required." });
  }

  next();
};

router.use(requireSuperAdmin);

// GET /admin/users - Get all users with their roles across organizations
router.get("/", async (req, res) => {
  try {
    // Get all users
    const allUsers = await db.select().from(users);
    
    // For each user, get their organization roles
    const usersWithRoles = await Promise.all(
      allUsers.map(async (user) => {
        // Get all organization associations for this user
        const userOrgs = await db
          .select({
            orgId: organizations.id,
            orgName: organizations.name,
            roleId: organizationUsers.roleId,
            roleName: roles.name,
          })
          .from(organizationUsers)
          .innerJoin(organizations, eq(organizationUsers.organizationId, organizations.id))
          .innerJoin(roles, eq(organizationUsers.roleId, roles.id))
          .where(eq(organizationUsers.userId, user.id));

        return {
          userId: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          roles: userOrgs.map(org => ({
            orgId: org.orgId,
            orgName: org.orgName,
            roleName: org.roleName
          }))
        };
      })
    );

    res.json(usersWithRoles);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Failed to fetch users", error: error.message });
  }
});

export default router;