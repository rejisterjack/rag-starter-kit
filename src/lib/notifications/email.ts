/**
 * Email Notification Service
 */

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export class EmailService {
  async sendEmail({
    to,
    template,
  }: {
    to: string;
    template: EmailTemplate;
  }): Promise<{ success: boolean; error?: string }> {
    // Implementation would use Resend, SendGrid, etc.
    console.log('Sending email to:', to, 'Subject:', template.subject);
    return { success: true };
  }

  welcomeEmail(userName: string, loginUrl: string): EmailTemplate {
    return {
      subject: 'Welcome to RAG Starter Kit!',
      html: `<div><h1>Welcome, ${userName}!</h1><a href="${loginUrl}">Get Started</a></div>`,
      text: `Welcome, ${userName}! Get started at ${loginUrl}`,
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
      html: `<div><p>Hi ${userName},</p><p>${mentionedBy} mentioned you:</p><blockquote>${commentContent}</blockquote><a href="${commentUrl}">View</a></div>`,
      text: `${mentionedBy} mentioned you: ${commentContent}`,
    };
  }
}

export const emailService = new EmailService();
export default emailService;
