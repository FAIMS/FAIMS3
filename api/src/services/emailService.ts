import nodemailer from 'nodemailer';
import { Transporter, SendMailOptions, SentMessageInfo } from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import NodeCache from 'node-cache';

/**
 * Enum representing the possible email service implementations.
 */
export enum EmailServiceType {
  /** SMTP Email Service */
  SMTP = 'SMTP',
  /** Mock Email Service for testing */
  MOCK = 'MOCK',
}

/**
 * Interface for email options
 */
export interface EmailOptions {
  /** Email recipient(s) */
  to: string | string[];
  /** Email subject */
  subject: string;
  /** Email text content */
  text?: string;
  /** Email HTML content */
  html?: string;
  /** Email CC recipient(s) */
  cc?: string | string[];
  /** Email BCC recipient(s) */
  bcc?: string | string[];
  /** Email attachments */
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
}

/**
 * Interface for email configuration
 */
export interface EmailConfig {
  /** Sender email address */
  fromEmail: string;
  /** Sender name */
  fromName: string;
  /** Reply-to email address */
  replyTo?: string;
}

/**
 * Interface for the email service.
 */
export interface IEmailService {
  /**
   * Sends an email using the configured service.
   * @param params - Email sending options.
   * @returns A Promise resolving to the result of the email sending operation.
   */
  sendEmail({ options }: { options: EmailOptions }): Promise<SentMessageInfo>;
}

/**
 * Abstract base class for email services.
 */
abstract class BaseEmailService implements IEmailService {
  protected config: EmailConfig;

  /**
   * Creates an instance of BaseEmailService.
   * @param params - The parameters for creating the service.
   */
  constructor({ config }: { config: EmailConfig }) {
    this.config = config;
  }

  /**
   * Abstract method to send an email.
   * @param params - The parameters for sending an email.
   * @returns A Promise resolving to the result of the email sending operation.
   */
  abstract sendEmail({ options }: { options: EmailOptions }): Promise<SentMessageInfo>;
}

/**
 * Interface for SMTP email service configuration.
 */
export interface SMTPEmailServiceConfig {
  /** SMTP host */
  host: string;
  /** SMTP port */
  port: number;
  /** Whether to use secure connection */
  secure: boolean;
  /** SMTP authentication */
  auth: {
    /** SMTP username */
    user: string;
    /** SMTP password */
    pass: string;
  };
  /** The number of seconds to cache transporter */
  cacheExpirySeconds?: number;
}

/**
 * Parameters for creating an SMTP email service
 */
interface SMTPEmailServiceParams {
  /** Email configuration */
  config: EmailConfig;
  /** SMTP configuration */
  smtpConfig: SMTPEmailServiceConfig;
}

/**
 * SMTP-based email service implementation.
 */
export class SMTPEmailService extends BaseEmailService {
  private smtpConfig: SMTPEmailServiceConfig;
  private transporter: Transporter<SMTPTransport.SentMessageInfo> | null = null;
  private cache: NodeCache;
  private readonly TRANSPORTER_CACHE_KEY = 'smtp-transporter';

  /**
   * Creates an instance of SMTPEmailService.
   * @param params - The parameters for creating the service.
   */
  constructor({ config, smtpConfig }: SMTPEmailServiceParams) {
    super({ config });
    this.smtpConfig = smtpConfig;
    this.cache = new NodeCache({
      stdTTL: this.smtpConfig.cacheExpirySeconds || 300, // Default 5 minutes
    });
  }

  /**
   * Gets or creates an SMTP transporter.
   * @returns The nodemailer transporter.
   */
  private async getTransporter(): Promise<Transporter<SMTPTransport.SentMessageInfo>> {
    // Check cache first
    const cachedTransporter = this.cache.get<Transporter<SMTPTransport.SentMessageInfo>>(
      this.TRANSPORTER_CACHE_KEY
    );
    
    if (cachedTransporter) {
      return cachedTransporter;
    }
    
    // Create new transporter
    const transporter = nodemailer.createTransport({
      host: this.smtpConfig.host,
      port: this.smtpConfig.port,
      secure: this.smtpConfig.secure,
      auth: {
        user: this.smtpConfig.auth.user,
        pass: this.smtpConfig.auth.pass,
      },
    });
    
    // Verify the connection
    try {
      await transporter.verify();
      console.log('SMTP connection verified successfully');
      
      // Cache the transporter
      this.cache.set(this.TRANSPORTER_CACHE_KEY, transporter);
      
      return transporter;
    } catch (error) {
      console.error('Failed to verify SMTP connection:', error);
      throw error;
    }
  }

  /**
   * Sends an email using SMTP.
   * @param params - The parameters for sending an email.
   * @returns A Promise resolving to the result of the email sending operation.
   */
  async sendEmail({ options }: { options: EmailOptions }): Promise<SentMessageInfo> {
    const transporter = await this.getTransporter();
    
    const mailOptions: SendMailOptions = {
      from: `"${this.config.fromName}" <${this.config.fromEmail}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      cc: options.cc,
      bcc: options.bcc,
      attachments: options.attachments,
      replyTo: this.config.replyTo || this.config.fromEmail,
    };
    
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent successfully', info.messageId);
      return info;
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
  }
}

/**
 * Parameters for creating a mock email service
 */
interface MockEmailServiceParams {
  /** Email configuration */
  config: EmailConfig;
}

/**
 * Mock email service implementation for testing.
 */
export class MockEmailService extends BaseEmailService {
  private sentEmails: Array<EmailOptions & { timestamp: Date }> = [];

  /**
   * Creates an instance of MockEmailService.
   * @param params - The parameters for creating the service.
   */
  constructor({ config }: MockEmailServiceParams) {
    super({ config });
  }

  /**
   * Sends an email (mock implementation).
   * @param params - The parameters for sending an email.
   * @returns A Promise resolving to a mock result of the email sending operation.
   */
  async sendEmail({ options }: { options: EmailOptions }): Promise<SentMessageInfo> {
    console.log('[MockEmailService] Sending email:', {
      from: `${this.config.fromName} <${this.config.fromEmail}>`,
      to: options.to,
      subject: options.subject,
    });
    
    // Store the email for later inspection
    this.sentEmails.push({
      ...options,
      timestamp: new Date(),
    });
    
    // Return a mock response
    return {
      messageId: `mock-email-${Date.now()}@test.com`,
      envelope: {
        from: this.config.fromEmail,
        to: Array.isArray(options.to) ? options.to : [options.to],
      },
      accepted: Array.isArray(options.to) ? options.to : [options.to],
      rejected: [],
      pending: [],
      response: 'Mock email sent successfully',
    };
  }

  /**
   * Gets all sent emails for inspection in tests.
   * @returns Array of all emails sent through this mock service.
   */
  getSentEmails(): Array<EmailOptions & { timestamp: Date }> {
    return this.sentEmails;
  }

  /**
   * Clears the record of sent emails.
   */
  clearSentEmails(): void {
    this.sentEmails = [];
  }
}

/**
 * Parameters for creating an email service
 */
interface CreateEmailServiceParams {
  /** The type of email service to create */
  serviceType: EmailServiceType;
  /** The email configuration */
  emailConfig: EmailConfig;
  /** Service-specific configuration */
  serviceConfig?: SMTPEmailServiceConfig;
}

/**
 * Creates and returns an instance of IEmailService based on the specified service type.
 * @param params - The parameters for creating the email service.
 * @returns An instance of IEmailService.
 * @throws Error if an unsupported service type is specified.
 */
export function createEmailService({ 
  serviceType, 
  emailConfig, 
  serviceConfig 
}: CreateEmailServiceParams): IEmailService {
  switch (serviceType) {
    case EmailServiceType.SMTP:
      if (!serviceConfig) {
        throw new Error('SMTP configuration is required for SMTP email service');
      }
      return new SMTPEmailService({ 
        config: emailConfig, 
        smtpConfig: serviceConfig 
      });
    
    case EmailServiceType.MOCK:
      return new MockEmailService({ 
        config: emailConfig 
      });
    
    default:
      throw new Error(`Unsupported email service type: ${serviceType}`);
  }
}