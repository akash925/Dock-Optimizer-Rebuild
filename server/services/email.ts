import { MailService } from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}

const mailService = new MailService();
mailService.setApiKey(process.env.SENDGRID_API_KEY);

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    await mailService.send({
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text ?? '',
      html: params.html,
    });
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    return false;
  }
}

export async function sendUserInvitationEmail(
  userEmail: string,
  temporaryPassword: string,
  organizationName: string,
  inviterName: string
): Promise<boolean> {
  const subject = `Welcome to ${organizationName} - Dock Optimizer`;
  
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #22c55e;">Welcome to Dock Optimizer!</h2>
      
      <p>Hello,</p>
      
      <p>You've been invited by ${inviterName} to join <strong>${organizationName}</strong> on the Dock Optimizer platform.</p>
      
      <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3>Your Login Details:</h3>
        <p><strong>Email:</strong> ${userEmail}</p>
        <p><strong>Temporary Password:</strong> <code style="background-color: #e2e8f0; padding: 4px 8px; border-radius: 4px;">${temporaryPassword}</code></p>
      </div>
      
      <p>Please log in and change your password immediately for security purposes.</p>
      
      <p style="margin-top: 30px;">
        <a href="${process.env.BASE_URL || 'https://dock-optimizer.com'}/login" 
           style="background-color: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Log In to Dock Optimizer
        </a>
      </p>
      
      <p style="margin-top: 30px; color: #64748b; font-size: 14px;">
        If you have any questions, please contact your administrator.
      </p>
    </div>
  `;
  
  const textContent = `
Welcome to Dock Optimizer!

You've been invited by ${inviterName} to join ${organizationName} on the Dock Optimizer platform.

Your Login Details:
Email: ${userEmail}
Temporary Password: ${temporaryPassword}

Please log in and change your password immediately for security purposes.

Visit: ${process.env.BASE_URL || 'https://dock-optimizer.com'}/login

If you have any questions, please contact your administrator.
  `;
  
  return await sendEmail({
    to: userEmail,
    from: process.env.FROM_EMAIL || 'noreply@dock-optimizer.com',
    subject,
    html: htmlContent,
    text: textContent
  });
}