import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getStorage } from '../storage';
import { sendPasswordResetEmail } from '../notifications';

const router = Router();

// Validation schemas
const requestPasswordResetSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const addEmailToAccountSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  email: z.string().email('Invalid email address'),
});

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  role: z.string().optional().default('user'),
});

// Request password reset
router.post('/request-password-reset', async (req: Request, res: Response) => {
  try {
    const { email } = requestPasswordResetSchema.parse(req.body);
    const storage = await getStorage();
    
    // Check if user exists with this email
    const user = await storage.getUserByEmail(email);
    
    if (!user) {
      // Don't reveal whether email exists for security
      return res.json({ 
        message: 'If an account with that email exists, a password reset link has been sent.' 
      });
    }
    
    // Generate and save reset token
    const resetToken = await storage.createPasswordResetToken(user.id);
    
    // Send password reset email
    await sendPasswordResetEmail(email, resetToken.token, user);
    
    // Clean up expired tokens periodically
    await storage.cleanupExpiredPasswordResetTokens();
    
    res.json({ 
      message: 'If an account with that email exists, a password reset link has been sent.' 
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid input', 
        details: error.errors 
      });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset password
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);
    const storage = await getStorage();
    
    // Validate reset token
    const resetToken = await storage.getPasswordResetToken(token);
    
    if (!resetToken) {
      return res.status(400).json({ 
        error: 'Invalid or expired reset token' 
      });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Update user password
    await storage.updateUserPasswordDirect(resetToken.userId, hashedPassword);
    
    // Mark token as used
    await storage.markPasswordResetTokenAsUsed(resetToken.id);
    
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Password reset error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid input', 
        details: error.errors 
      });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Validate reset token (for frontend to check if token is valid)
router.get('/validate-reset-token/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const storage = await getStorage();
    
    const resetToken = await storage.getPasswordResetToken(token);
    
    if (!resetToken) {
      return res.status(400).json({ 
        valid: false, 
        error: 'Invalid or expired reset token' 
      });
    }
    
    res.json({ valid: true });
  } catch (error) {
    console.error('Token validation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add email to existing account (for users without email)
router.post('/add-email-to-account', async (req: Request, res: Response) => {
  try {
    const { username, email } = addEmailToAccountSchema.parse(req.body);
    const storage = await getStorage();
    
    // Check if user exists with this username
    const user = await storage.getUserByUsername(username);
    
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }
    
    // Check if user already has an email
    if (user.email && user.email.trim() !== '') {
      return res.status(400).json({ 
        error: 'User already has an email address associated with their account' 
      });
    }
    
    // Check if email is already in use by another user
    const existingUser = await storage.getUserByEmail(email);
    if (existingUser && existingUser.id !== user.id) {
      return res.status(400).json({ 
        error: 'Email address is already in use by another account' 
      });
    }
    
    // Update user with email
    await storage.updateUserEmail(user.id, email);
    
    res.json({ 
      message: 'Email address has been associated with your account successfully',
      canRequestReset: true
    });
  } catch (error) {
    console.error('Add email to account error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid input', 
        details: error.errors 
      });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User registration
router.post('/register', async (req: Request, res: Response) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    const storage = await getStorage();
    
    // Check if username already exists
    const existingUserByUsername = await storage.getUserByUsername(validatedData.username);
    if (existingUserByUsername) {
      return res.status(400).json({ 
        error: 'Username already exists' 
      });
    }
    
    // Check if email already exists
    const existingUserByEmail = await storage.getUserByEmail(validatedData.email);
    if (existingUserByEmail) {
      return res.status(400).json({ 
        error: 'Email address is already in use' 
      });
    }
    
    // Extract organization name from firstName or create default
    const organizationName = validatedData.firstName.includes(' ') 
      ? validatedData.firstName // If firstName contains organization name like "RMHC Philly"
      : `${validatedData.firstName} ${validatedData.lastName} Organization`;
    
    // Create subdomain from organization name
    const subdomain = organizationName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .slice(0, 50); // Limit length
    
    // Check if organization exists with this subdomain
    let organization: any = null;
    try {
      organization = await storage.getTenantBySubdomain?.(subdomain);
    } catch (error) {
      console.log('[Registration] getTenantBySubdomain not available, will create new organization');
    }
    
    // Create organization if it doesn't exist
    if (!organization) {
      try {
        organization = await storage.createTenant({
          name: organizationName,
          subdomain: subdomain,
          status: 'ACTIVE',
          primaryContact: `${validatedData.firstName} ${validatedData.lastName}`,
          contactEmail: validatedData.email,
          timezone: 'America/New_York',
          subscription: 'basic',
          settings: JSON.stringify({}),
          metadata: JSON.stringify({})
        });
        
        console.log(`[Registration] Created new organization: ${organizationName} (ID: ${organization.id})`);
      } catch (orgError) {
        console.error('[Registration] Failed to create organization:', orgError);
        // Continue with registration but without organization assignment
        organization = null;
      }
    }
    
    // Create the user with organization assignment
    const newUser = await storage.createUser({
      username: validatedData.username,
      email: validatedData.email,
      password: validatedData.password,
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      role: validatedData.role as any,
      tenantId: organization?.id || null
    });
    
    // If organization was created, add user to organization with admin role
    if (organization) {
      try {
        // Get or create admin role
        let adminRole = await storage.getRoleByName?.('admin');
        if (!adminRole) {
          const roles = (await storage.getRoles?.()) || [];
          adminRole = roles.find(r => r.name.toLowerCase() === 'admin');
        }
        
        if (adminRole) {
          await storage.addUserToOrganization({
            organizationId: organization.id,
            userId: newUser.id,
            roleId: adminRole.id
          });
          
          console.log(`[Registration] Added user ${newUser.id} to organization ${organization.id} with admin role`);
        }
      } catch (orgUserError) {
        console.error('[Registration] Failed to add user to organization:', orgUserError);
      }
    }
    
    // AUTO-LOGIN: Establish session after successful registration
    const authUser = {
      ...newUser,
      tenantId: newUser.tenantId || undefined,
      modules: [] // Will be populated by passport deserializeUser
    };
    
    // Log the user in automatically
    (req as any).logIn(authUser, async (err: any) => {
      if (err) {
        console.error('Auto-login error after registration:', err);
        // Still return success but without auto-login
        const { password, ...safeUser } = newUser;
        return res.status(201).json({
          ...safeUser,
          modules: [],
          autoLoginFailed: true
        });
      }
      
      // ADMIN NOTIFICATION: Send email to akash.agarwal@conmitto.io
      try {
        const { sendEmail } = await import('../notifications');
        await sendEmail({
          to: 'akash.agarwal@conmitto.io',
          subject: 'New User Registration - Dock Optimizer',
          html: `
          <h2>New User Registration</h2>
          <p>A new user has registered for Dock Optimizer:</p>
          <ul>
            <li><strong>Name:</strong> ${validatedData.firstName} ${validatedData.lastName}</li>
            <li><strong>Email:</strong> ${validatedData.email}</li>
            <li><strong>Username:</strong> ${validatedData.username}</li>
            <li><strong>Role:</strong> ${validatedData.role}</li>
            <li><strong>Organization:</strong> ${organizationName} ${organization ? '(Created)' : '(Not assigned)'}</li>
            <li><strong>Registration Time:</strong> ${new Date().toISOString()}</li>
          </ul>
                     <p>Please review and assign appropriate permissions as needed.</p>
           `
        });
        
        console.log('[Registration] Admin notification sent successfully');
      } catch (adminNotificationError) {
        console.error('[Registration] Failed to send admin notification:', adminNotificationError);
      }
      
      // WELCOME EMAIL: Send welcome email to new user
      try {
        const { sendEmail } = await import('../notifications');
        const roleDisplayName = validatedData.role === 'admin' ? 'Administrator' : 
                               validatedData.role === 'manager' ? 'Manager' : 'Dock Worker';
        
        await sendEmail({
          to: validatedData.email,
          subject: 'Welcome to Dock Optimizer!',
          html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #2563eb;">Welcome to Dock Optimizer!</h1>
            
            <p>Dear ${validatedData.firstName},</p>
            
            <p>Thank you for joining Dock Optimizer! We're excited to help streamline your warehouse operations and improve your supply chain management.</p>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #374151;">Your Account Details:</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li><strong>Name:</strong> ${validatedData.firstName} ${validatedData.lastName}</li>
                <li><strong>Email:</strong> ${validatedData.email}</li>
                <li><strong>User Type:</strong> ${roleDisplayName}</li>
                <li><strong>Organization:</strong> ${organizationName}</li>
              </ul>
            </div>
            
            <h3 style="color: #374151;">What's Next?</h3>
            <ul>
              <li>Explore your dashboard to get familiar with the interface</li>
              <li>Set up your facility information and dock configurations</li>
              <li>Create your first appointment types</li>
              <li>Start scheduling appointments and optimizing your dock operations</li>
            </ul>
            
            <p>If you have any questions or need assistance getting started, please don't hesitate to reach out to our support team.</p>
            
            <p style="margin-top: 30px;">
              Best regards,<br>
              <strong>The Dock Optimizer Team</strong>
            </p>
            
            <div style="border-top: 1px solid #e5e7eb; margin-top: 30px; padding-top: 20px; text-align: center; color: #6b7280; font-size: 14px;">
              <p>Dock Optimizer - Effortless Warehouse Scheduling & Supply Chain Management</p>
            </div>
                     </div>
           `
        });
        
        console.log('[Registration] Welcome email sent successfully');
      } catch (welcomeEmailError) {
        console.error('[Registration] Failed to send welcome email:', welcomeEmailError);
      }
      
      // Return success with user data and auto-login confirmation
      const { password, ...safeUser } = newUser;
      res.status(201).json({
        ...safeUser,
        modules: authUser.modules || [],
        organizationCreated: !!organization,
        organizationName: organizationName,
        autoLogin: true
      });
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid input', 
        details: error.errors 
      });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 