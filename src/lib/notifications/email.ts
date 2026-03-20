/**
 * Email Notification Service
 *
 * Supports multiple email providers: SMTP, Resend, SendGrid
 * Falls back to console logging in development if not configured.
 */

// Type definitions for nodemailer (used with dynamic import)
interface NodemailerTransport {
  sendMail(options: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<unknown>;
}

interface NodemailerModule {
  createTransport(options: {
    host?: string;
    port?: number;
    secure?: boolean;
    auth?: { user?: string; pass?: string };
  }): NodemailerTransport;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface EmailConfig {
  provider: 'smtp' | 'resend' | 'sendgrid' | 'console';
  // SMTP settings
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  smtpSecure?: boolean;
  smtpFrom?: string;
  // API keys for transactional services
  resendApiKey?: string;
  sendgridApiKey?: string;
  // Default from address
  from?: string;
  fromName?: string;
}

// =============================================================================
// Email Service
// =============================================================================

export class EmailService {
  private config: EmailConfig;

  constructor(config?: Partial<EmailConfig>) {
    // Determine provider from environment
    const envProvider = this.detectProviderFromEnv();

    this.config = {
      provider: envProvider,
      from: process.env.SMTP_FROM || 'noreply@example.com',
      fromName: 'RAG Starter Kit',
      ...config,
    };
  }

  /**
   * Send an email using the configured provider
   */
  async sendEmail({
    to,
    template,
  }: {
    to: string;
    template: EmailTemplate;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const from = `${this.config.fromName} <${this.config.from}>`;

      switch (this.config.provider) {
        case 'smtp':
          return await this.sendViaSMTP(to, from, template);
        case 'resend':
          return await this.sendViaResend(to, from, template);
        case 'sendgrid':
          return await this.sendViaSendGrid(to, from, template);
        case 'console':
        default:
          return await this.sendViaConsole(to, from, template);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('Email sending error:', errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Check if email service is properly configured
   */
  isConfigured(): boolean {
    return this.config.provider !== 'console';
  }

  // ===========================================================================
  // Email Templates
  // ===========================================================================

  welcomeEmail(userName: string, loginUrl: string): EmailTemplate {
    return {
      subject: 'Welcome to RAG Starter Kit!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Welcome, ${userName}!</h1>
          <p>Thank you for joining RAG Starter Kit. We're excited to have you on board!</p>
          <p>Get started by logging in to your account:</p>
          <a href="${loginUrl}" style="display: inline-block; padding: 12px 24px; background-color: #0070f3; color: white; text-decoration: none; border-radius: 5px;">Get Started</a>
          <p style="margin-top: 20px; color: #666; font-size: 12px;">
            If the button doesn't work, copy and paste this link: ${loginUrl}
          </p>
        </div>
      `,
      text: `Welcome, ${userName}! Thank you for joining RAG Starter Kit. Get started at ${loginUrl}`,
    };
  }

  invitationEmail({
    invitedByName,
    workspaceName,
    inviteUrl,
    expiresAt,
  }: {
    invitedByName: string;
    workspaceName: string;
    inviteUrl: string;
    expiresAt: Date;
  }): EmailTemplate {
    const expiresDate = expiresAt.toLocaleDateString();

    return {
      subject: `${invitedByName} invited you to join ${workspaceName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">You're Invited!</h1>
          <p><strong>${invitedByName}</strong> has invited you to join the workspace <strong>${workspaceName}</strong> on RAG Starter Kit.</p>
          <p>Click the button below to accept the invitation:</p>
          <a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; background-color: #0070f3; color: white; text-decoration: none; border-radius: 5px;">Accept Invitation</a>
          <p style="margin-top: 20px; color: #666;">
            This invitation will expire on <strong>${expiresDate}</strong>.
          </p>
          <p style="color: #666; font-size: 12px;">
            If the button doesn't work, copy and paste this link: ${inviteUrl}
          </p>
        </div>
      `,
      text: `${invitedByName} invited you to join ${workspaceName} on RAG Starter Kit. Accept here: ${inviteUrl} (expires ${expiresDate})`,
    };
  }

  passwordResetEmail({
    userName,
    resetUrl,
    expiresAt,
  }: {
    userName: string;
    resetUrl: string;
    expiresAt: Date;
  }): EmailTemplate {
    const expiresDate = expiresAt.toLocaleDateString();
    const expiresTime = expiresAt.toLocaleTimeString();

    return {
      subject: 'Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Password Reset</h1>
          <p>Hi ${userName},</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #0070f3; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
          <p style="margin-top: 20px; color: #666;">
            This link will expire on <strong>${expiresDate} at ${expiresTime}</strong>.
          </p>
          <p style="color: #666; font-size: 12px;">
            If you didn't request this, you can safely ignore this email.
          </p>
        </div>
      `,
      text: `Hi ${userName}, reset your password here: ${resetUrl} (expires ${expiresDate} at ${expiresTime}). If you didn't request this, ignore this email.`,
    };
  }

  mentionEmail({
    userName,
    mentionedBy,
    commentContent,
    conversationTitle,
    commentUrl,
  }: {
    userName: string;
    mentionedBy: string;
    commentContent: string;
    conversationTitle: string;
    commentUrl: string;
  }): EmailTemplate {
    return {
      subject: `${mentionedBy} mentioned you in ${conversationTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">You were mentioned</h1>
          <p>Hi ${userName},</p>
          <p><strong>${mentionedBy}</strong> mentioned you in <strong>${conversationTitle}</strong>:</p>
          <blockquote style="border-left: 3px solid #0070f3; padding-left: 15px; color: #555;">
            ${commentContent}
          </blockquote>
          <a href="${commentUrl}" style="display: inline-block; padding: 12px 24px; background-color: #0070f3; color: white; text-decoration: none; border-radius: 5px;">View Conversation</a>
        </div>
      `,
      text: `${mentionedBy} mentioned you in ${conversationTitle}: ${commentContent}. View at ${commentUrl}`,
    };
  }

  // ===========================================================================
  // Private Send Methods
  // ===========================================================================

  private async sendViaSMTP(
    to: string,
    from: string,
    template: EmailTemplate
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Dynamic import for optional nodemailer dependency
      // @ts-expect-error - nodemailer is an optional dependency
      const nodemailer = (await import('nodemailer')) as NodemailerModule;

      const transporter = nodemailer.createTransport({
        host: this.config.smtpHost,
        port: this.config.smtpPort || 587,
        secure: this.config.smtpSecure || false,
        auth: {
          user: this.config.smtpUser,
          pass: this.config.smtpPassword,
        },
      });

      await transporter.sendMail({
        from,
        to,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SMTP error',
      };
    }
  }

  private async sendViaResend(
    to: string,
    from: string,
    template: EmailTemplate
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const apiKey = this.config.resendApiKey || process.env.RESEND_API_KEY;

      if (!apiKey) {
        throw new Error('Resend API key not configured');
      }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to,
          subject: template.subject,
          html: template.html,
          text: template.text,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Resend API error: ${error}`);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Resend error',
      };
    }
  }

  private async sendViaSendGrid(
    to: string,
    from: string,
    template: EmailTemplate
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const apiKey = this.config.sendgridApiKey || process.env.SENDGRID_API_KEY;

      if (!apiKey) {
        throw new Error('SendGrid API key not configured');
      }

      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: from.replace(/.*<(.+)>.*/, '$1'), name: this.config.fromName },
          subject: template.subject,
          content: [
            { type: 'text/plain', value: template.text },
            { type: 'text/html', value: template.html },
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`SendGrid API error: ${error}`);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SendGrid error',
      };
    }
  }

  private async sendViaConsole(
    to: string,
    from: string,
    template: EmailTemplate
  ): Promise<{ success: boolean; error?: string }> {
    console.log('📧 Email (Console Mode):');
    console.log('From:', from);
    console.log('To:', to);
    console.log('Subject:', template.subject);
    console.log('Text:', template.text);
    console.log('---');

    return { success: true };
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private detectProviderFromEnv(): EmailConfig['provider'] {
    if (process.env.RESEND_API_KEY) return 'resend';
    if (process.env.SENDGRID_API_KEY) return 'sendgrid';
    if (process.env.SMTP_HOST) return 'smtp';
    return 'console';
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const emailService = new EmailService();
export default emailService;
