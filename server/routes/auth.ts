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
    
    // Create the user
    const newUser = await storage.createUser({
      username: validatedData.username,
      email: validatedData.email,
      password: validatedData.password,
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      role: validatedData.role as any,
      tenantId: null // New users start without tenant assignment
    });
    
    // Return user data without password
    const { password, ...safeUser } = newUser;
    res.status(201).json({
      ...safeUser,
      modules: [] // New users start with no modules until assigned to organization
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