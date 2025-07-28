import express, { Request, Response, NextFunction } from "express";
import { getStorage } from "../../../storage.js";
import { db } from "../../../db.js";
import { eq, sql } from "drizzle-orm";
import { users, organizationUsers, roles } from "@shared/schema";
import { tenants as organizations } from "@shared/schema";

const router = express.Router();

// Middleware to check if user is a super-admin
const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (req.user?.role !== "super-admin") {
    return res.status(403).json({ message: "Access denied. Super admin role required." });
  }

  next();
};

router.use(requireSuperAdmin);

// GET /admin/users - Get all users with their roles across organizations (with pagination)
router.get("/", async (req: Request, res: Response) => {
  try {
    // Parse pagination parameters
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    // Get total count for pagination
    const totalUsers = await db.select({ count: sql`count(*)` }).from(users);
    const total = Number(totalUsers[0]?.count || 0);
    
    // Use raw SQL query with json_agg to get users with their memberships in one go
    const userQuery = sql`
      SELECT 
        u.id, 
        u.email, 
        u.username, 
        u.first_name AS "firstName", 
        u.last_name AS "lastName",
        COALESCE(
          json_agg(
            json_build_object(
              'orgId', ou.organization_id,
              'orgName', t.name,
              'roleName', r.name
            ) 
          ) FILTER (WHERE ou.organization_id IS NOT NULL), 
          '[]'
        ) AS memberships
      FROM users u
      LEFT JOIN organization_users ou ON ou.user_id = u.id
      LEFT JOIN tenants t ON t.id = ou.organization_id
      LEFT JOIN roles r ON r.id = ou.role_id
      GROUP BY u.id
      ORDER BY u.id
      LIMIT ${limit} OFFSET ${offset}
    `;
    
    const usersWithMemberships = await db.execute(userQuery);
    
    // Return the results with pagination info
    res.json({
      items: usersWithMemberships,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: unknown) {
    console.error("Error fetching users:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: "Failed to fetch users", error: errorMessage });
  }
});

// POST /admin/users - Create a new user
router.post("/", async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ 
        message: "Missing required fields. Email, password, firstName, and lastName are required." 
      });
    }
    
    // Check if user with this email already exists
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email));
      
    if (existingUser.length > 0) {
      return res.status(400).json({ message: "User with this email already exists" });
    }
    
    const storage = await getStorage();
    
    // Create the user
    const newUser = await storage.createUser({
      email,
      username: email, // Using email as username
      password,
      firstName,
      lastName,
      role: "user", // Default role
      tenantId: null // No tenant assigned by default
    });
    
    res.status(201).json(newUser);
  } catch (error: unknown) {
    console.error("Error creating user:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: "Failed to create user", error: errorMessage });
  }
});

// GET /admin/users/:userId - Get detailed user information with memberships
router.get("/:userId", async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    // Use raw SQL query with json_agg to get user with memberships in one go
    const userQuery = sql`
      SELECT 
        u.id, 
        u.email, 
        u.username, 
        u.first_name AS "firstName", 
        u.last_name AS "lastName",
        COALESCE(
          json_agg(
            json_build_object(
              'orgId', ou.organization_id,
              'orgName', t.name,
              'roleName', r.name
            ) 
          ) FILTER (WHERE ou.organization_id IS NOT NULL), 
          '[]'
        ) AS memberships
      FROM users u
      LEFT JOIN organization_users ou ON ou.user_id = u.id
      LEFT JOIN tenants t ON t.id = ou.organization_id
      LEFT JOIN roles r ON r.id = ou.role_id
      WHERE u.id = ${userId}
      GROUP BY u.id
    `;
    
    const results = (await db.execute(userQuery)) as any;
    
    if (results.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.json(results[0]);
  } catch (error: unknown) {
    console.error("Error fetching user details:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: "Failed to fetch user details", error: errorMessage });
  }
});

// PUT /admin/users/:userId/orgs - Add or remove user from an organization
router.put("/:userId/orgs", async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const { orgId, roleName, action } = req.body;

    // Validate request body
    if (!orgId || (action === "add" && !roleName) || !["add", "remove"].includes(action)) {
      return res.status(400).json({ 
        message: "Invalid request. Must include orgId, roleName (for add), and action ('add' or 'remove')" 
      });
    }

    // Check if user exists
    const [userExists] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId));

    if (!userExists) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if organization exists
    const [orgExists] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, orgId));

    if (!orgExists) {
      return res.status(404).json({ message: "Organization not found" });
    }

    const storage = await getStorage();

    if (action === "add") {
      // Find role ID by name
      const [role] = await db
        .select()
        .from(roles)
        .where(eq(roles.name, roleName));

      if (!role) {
        return res.status(404).json({ message: `Role '${roleName}' not found` });
      }

      // Check if the user is already in the organization
      const userOrgs = await storage.getOrganizationUsers(orgId);
      const existingUserOrg = userOrgs.find(ou => ou.userId === userId);
      
      if (existingUserOrg) {
        return res.status(400).json({ message: "User is already assigned to this organization" });
      }

      // Add user to organization
      const result = await storage.addUserToOrganization({
        userId,
        organizationId: orgId,
        roleId: role.id
      });

      res.status(200).json({
        message: "User added to organization successfully",
        data: { userId, orgId, roleId: role.id, roleName }
      });
    } else { // action === "remove"
      // Check if the user is in the organization
      const userOrgs = await storage.getOrganizationUsers(orgId);
      const existingUserOrg = userOrgs.find(ou => ou.userId === userId);
      
      if (!existingUserOrg) {
        return res.status(400).json({ message: "User is not assigned to this organization" });
      }

      // Don't allow removing the last super-admin from the admin organization
      if (orgId === 1) { // Assuming 1 is the admin org ID
        const [org] = await db
          .select()
          .from(organizations)
          .where(eq(organizations.id, orgId));
          
        if (org.subdomain === 'admin') {
          const [userRole] = await db
            .select()
            .from(roles)
            .where(eq(roles.id, existingUserOrg.roleId));
            
          if (userRole && userRole.name === 'super-admin') {
            // Count super-admins in the admin org
            const adminOrgUsers = await storage.getOrganizationUsers(orgId);
            
            let superAdminCount = 0;
            for (const ou of adminOrgUsers) {
              const [role] = await db
                .select()
                .from(roles)
                .where(eq(roles.id, ou.roleId));
                
              if (role && role.name === 'super-admin') {
                superAdminCount++;
              }
            }
            
            if (superAdminCount <= 1) {
              return res.status(403).json({ 
                message: 'Cannot remove the last super-admin from the system' 
              });
            }
          }
        }
      }

      // Remove user from organization
      await storage.removeUserFromOrganization(userId, orgId);

      res.status(200).json({
        message: "User removed from organization successfully"
      });
    }
  } catch (error: unknown) {
    console.error("Error managing user organization:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message: "Failed to update user organization", error: errorMessage });
  }
});

export default router;