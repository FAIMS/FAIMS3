import {expect} from 'chai';
import {
  createEmailService,
  EmailServiceType,
  MockEmailService,
  EmailConfig,
  EmailOptions,
} from '../src/services/emailService';

describe('Email Service', () => {
  // Create a mock email service for testing
  const mockEmailConfig: EmailConfig = {
    fromEmail: 'test@example.com',
    fromName: 'Test System',
    replyTo: 'support@example.com',
  };

  let mockEmailService: MockEmailService;

  beforeEach(() => {
    // Create a fresh mock email service before each test
    mockEmailService = createEmailService({
      serviceType: EmailServiceType.MOCK,
      emailConfig: mockEmailConfig,
    }) as MockEmailService;

    // Clear any stored emails
    mockEmailService.clearSentEmails();
  });

  it('should send emails with correct sender information', async () => {
    // Arrange
    const options: EmailOptions = {
      to: 'recipient@example.com',
      subject: 'Test Email',
      text: 'This is a test email.',
    };

    // Act
    const result = await mockEmailService.sendEmail({options});

    // Assert
    expect(result).not.to.be.undefined;
    expect(result.messageId).to.include('mock-email');
    expect(result.envelope.from).to.equal(mockEmailConfig.fromEmail);

    const sentEmails = mockEmailService.getSentEmails();
    expect(sentEmails.length).to.equal(1);
    expect(sentEmails[0].to).to.equal(options.to);
    expect(sentEmails[0].subject).to.equal(options.subject);
    expect(sentEmails[0].text).to.equal(options.text);
  });

  it('should handle multiple recipients', async () => {
    // Arrange
    const recipients = [
      'user1@example.com',
      'user2@example.com',
      'user3@example.com',
    ];
    const options: EmailOptions = {
      to: recipients,
      subject: 'Batch Test Email',
      text: 'This is a batch test email.',
    };

    // Act
    const result = await mockEmailService.sendEmail({options});

    // Assert
    expect(result).not.to.be.undefined;
    expect(result.envelope.to).to.deep.equal(recipients);
    expect(result.accepted).to.deep.equal(recipients);
    expect(result.rejected).to.be.empty;

    const sentEmails = mockEmailService.getSentEmails();
    expect(sentEmails.length).to.equal(1);
    expect(sentEmails[0].to).to.deep.equal(recipients);
  });

  it('should handle HTML content', async () => {
    // Arrange
    const htmlContent =
      '<h1>Hello World</h1><p>This is a test email with HTML content.</p>';
    const options: EmailOptions = {
      to: 'recipient@example.com',
      subject: 'HTML Test Email',
      html: htmlContent,
      text: 'Hello World\n\nThis is a test email with HTML content.',
    };

    // Act
    await mockEmailService.sendEmail({options});

    // Assert
    const sentEmails = mockEmailService.getSentEmails();
    expect(sentEmails.length).to.equal(1);
    expect(sentEmails[0].html).to.equal(htmlContent);
  });

  it('should handle email attachments', async () => {
    // Arrange
    const attachment = {
      filename: 'test.txt',
      content: 'This is a test attachment',
      contentType: 'text/plain',
    };

    const options: EmailOptions = {
      to: 'recipient@example.com',
      subject: 'Email with Attachment',
      text: 'This email has an attachment.',
      attachments: [attachment],
    };

    // Act
    await mockEmailService.sendEmail({options});

    // Assert
    const sentEmails = mockEmailService.getSentEmails();
    expect(sentEmails.length).to.equal(1);
    expect(sentEmails[0].attachments).to.not.be.undefined;
    expect(sentEmails[0].attachments?.length).to.equal(1);
    expect(sentEmails[0].attachments?.[0].filename).to.equal(
      attachment.filename
    );
    expect(sentEmails[0].attachments?.[0].content).to.equal(attachment.content);
    expect(sentEmails[0].attachments?.[0].contentType).to.equal(
      attachment.contentType
    );
  });

  it('should handle CC and BCC recipients', async () => {
    // Arrange
    const ccRecipients = ['cc1@example.com', 'cc2@example.com'];
    const bccRecipients = ['bcc1@example.com', 'bcc2@example.com'];

    const options: EmailOptions = {
      to: 'primary@example.com',
      subject: 'CC and BCC Test',
      text: 'This email tests CC and BCC functionality.',
      cc: ccRecipients,
      bcc: bccRecipients,
    };

    // Act
    await mockEmailService.sendEmail({options});

    // Assert
    const sentEmails = mockEmailService.getSentEmails();
    expect(sentEmails.length).to.equal(1);
    expect(sentEmails[0].cc).to.deep.equal(ccRecipients);
    expect(sentEmails[0].bcc).to.deep.equal(bccRecipients);
  });

  it('should record email sending timestamp', async () => {
    // Arrange
    const options: EmailOptions = {
      to: 'recipient@example.com',
      subject: 'Timestamp Test',
      text: 'This email tests timestamp recording.',
    };

    // Act
    const beforeSend = new Date();
    await mockEmailService.sendEmail({options});
    const afterSend = new Date();

    // Assert
    const sentEmails = mockEmailService.getSentEmails();
    expect(sentEmails.length).to.equal(1);
    expect(sentEmails[0].timestamp).to.not.be.undefined;

    // Verify timestamp is between beforeSend and afterSend
    const emailTimestamp = sentEmails[0].timestamp;
    expect(emailTimestamp.getTime()).to.be.at.least(beforeSend.getTime());
    expect(emailTimestamp.getTime()).to.be.at.most(afterSend.getTime());
  });

  it('should clear sent emails when requested', async () => {
    // Arrange
    const options1: EmailOptions = {
      to: 'recipient1@example.com',
      subject: 'First Test Email',
      text: 'This is the first test email.',
    };

    const options2: EmailOptions = {
      to: 'recipient2@example.com',
      subject: 'Second Test Email',
      text: 'This is the second test email.',
    };

    // Act
    await mockEmailService.sendEmail({options: options1});
    await mockEmailService.sendEmail({options: options2});

    // Verify two emails were sent
    expect(mockEmailService.getSentEmails().length).to.equal(2);

    // Clear sent emails
    mockEmailService.clearSentEmails();

    // Assert
    expect(mockEmailService.getSentEmails().length).to.equal(0);
  });
});
