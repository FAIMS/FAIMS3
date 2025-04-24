/**
 * Email Helpers Module
 *
 * This module provides email template functions for sending various system emails
 * through the email service.
 */

import {
  CONDUCTOR_PUBLIC_URL,
  EMAIL_SERVICE,
  WEBAPP_PUBLIC_URL,
} from '../buildconfig';
import {EmailOptions} from '../services/emailService';

/**
 * Build a URL with the verification code embedded for easy user access
 *
 * @param code The verification code to embed in the URL
 * @returns The complete verification URL
 */
export function buildVerificationUrl({code}: {code: string}): string {
  return `${CONDUCTOR_PUBLIC_URL}/verify-email?code=${encodeURIComponent(
    code
  )}&redirect=${encodeURIComponent(WEBAPP_PUBLIC_URL)}`;
}

/**
 * Sends an email verification challenge to a user.
 *
 * @param params - Object containing the parameters
 * @param params.emailService - The email service to use
 * @param params.recipientEmail - The recipient's email address
 * @param params.userName - The recipient's name
 * @param params.verificationCode - The verification code
 * @param params.expiresInHours - How many hours until the code expires (default: 24)
 * @returns A Promise that resolves when the email has been sent
 */
export async function sendEmailVerificationChallenge({
  recipientEmail,
  username,
  verificationCode,
  expiryTimestampMs,
}: {
  recipientEmail: string;
  username: string;
  verificationCode: string;
  expiryTimestampMs: number;
}): Promise<void> {
  // Calculate expiry in hours from milliseconds
  const expiryMs = expiryTimestampMs - Date.now();
  // Convert ms to hours and round up
  const expiryHours = Math.ceil(expiryMs / (1000 * 60 * 60));
  const emailService = EMAIL_SERVICE;
  const verificationUrl = buildVerificationUrl({code: verificationCode});

  const subject = 'Verify Your Email Address';

  // Plain text version of the email
  const textContent = `
Hello ${username},

Thank you for registering your email address with us. To complete the verification process, please click the link below:
${verificationUrl}

This verification code will expire in ${expiryHours} hours.

If you did not request this verification, please ignore this email.
  `.trim();

  // HTML version of the email
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email Address</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 30px;
      border: 1px solid #e0e0e0;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
    }
    .code {
      background-color: #f5f5f5;
      padding: 12px;
      font-size: 18px;
      letter-spacing: 2px;
      text-align: center;
      border-radius: 4px;
      font-family: monospace;
      margin: 20px 0;
    }
    .button {
      display: block;
      width: 100%;
      max-width: 250px;
      background-color:rgb(216, 220, 231);
      color: white;
      text-align: center;
      padding: 12px 20px;
      text-decoration: none;
      border-radius: 4px;
      font-weight: bold;
      margin: 25px auto;
    }
    .footer {
      color: #888888;
      font-size: 14px;
      margin-top: 30px;
      text-align: center;
      border-top: 1px solid #e0e0e0;
      padding-top: 20px;
    }
    @media only screen and (max-width: 480px) {
      body {
        padding: 10px;
      }
      .container {
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Verify Your Email Address</h1>
    </div>
    <p>Hello ${username},</p>
    <p>Thank you for registering your email address with us. To complete the verification process, please click the button below:</p>
    <a href="${verificationUrl}" class="button">Verify Email</a>
    <p>This verification code will expire in ${expiryHours} hours.</p>
    <p>If you did not request this verification, please ignore this email.</p>
    <div class="footer">
      <p>This is an automated message. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const emailOptions: EmailOptions = {
    to: recipientEmail,
    subject,
    text: textContent,
    html: htmlContent,
  };

  await emailService.sendEmail({options: emailOptions});
}

/**
 * Builds a password reset URL with the reset code embedded
 *
 * @param code The reset code to embed in the URL
 * @returns The complete password reset URL
 */
export function buildPasswordResetUrl({
  code,
  redirect,
}: {
  code: string;
  redirect: string;
}): string {
  return `${CONDUCTOR_PUBLIC_URL}/auth/reset-password?code=${encodeURIComponent(code)}&redirect=${redirect}`;
}

/**
 * Sends a password reset email to a user.
 *
 * @param recipientEmail - The recipient's email address
 * @param username - The recipient's username or name
 * @param resetCode - The password reset code
 * @param expiryTimestampMs - Timestamp in milliseconds when the code expires
 * @returns A Promise that resolves when the email has been sent
 */
export async function sendPasswordResetEmail({
  recipientEmail,
  username,
  resetCode,
  redirect,
  expiryTimestampMs,
}: {
  recipientEmail: string;
  username: string;
  resetCode: string;
  expiryTimestampMs: number;
  redirect: string;
}): Promise<void> {
  // Calculate expiry in hours from milliseconds
  const expiryMs = expiryTimestampMs - Date.now();
  // Convert ms to hours and round up
  const expiryHours = Math.ceil(expiryMs / (1000 * 60 * 60));
  const emailService = EMAIL_SERVICE;
  const resetUrl = buildPasswordResetUrl({code: resetCode, redirect});

  const subject = 'Reset Your Password';

  // Plain text version of the email
  const textContent = `
Hello ${username},

We received a request to reset your password. To proceed with the password reset, please click the link below:
${resetUrl}

This link will expire in ${expiryHours} hours.

If you did not request a password reset, you can safely ignore this email. Your account security has not been compromised.
  `.trim();

  // HTML version of the email
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 30px;
      border: 1px solid #e0e0e0;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
    }
    .button {
      display: block;
      width: 100%;
      max-width: 250px;
      background-color: rgb(216, 220, 231);
      color: white;
      text-align: center;
      padding: 12px 20px;
      text-decoration: none;
      border-radius: 4px;
      font-weight: bold;
      margin: 25px auto;
    }
    .warning {
      background-color: #fff9e6;
      border-left: 4px solid #ffcc00;
      padding: 12px;
      margin: 20px 0;
    }
    .footer {
      color: #888888;
      font-size: 14px;
      margin-top: 30px;
      text-align: center;
      border-top: 1px solid #e0e0e0;
      padding-top: 20px;
    }
    @media only screen and (max-width: 480px) {
      body {
        padding: 10px;
      }
      .container {
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Reset Your Password</h1>
    </div>
    <p>Hello ${username},</p>
    <p>We received a request to reset your password. To proceed with the password reset, please click the button below:</p>
    <a href="${resetUrl}" class="button">Reset Password</a>
    <p>This link will expire in ${expiryHours} hours.</p>
    <div class="warning">
      <p><strong>Note:</strong> If you did not request a password reset, you can safely ignore this email. Your account security has not been compromised.</p>
    </div>
    <div class="footer">
      <p>This is an automated message. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const emailOptions: EmailOptions = {
    to: recipientEmail,
    subject,
    text: textContent,
    html: htmlContent,
  };

  await emailService.sendEmail({options: emailOptions});
}
