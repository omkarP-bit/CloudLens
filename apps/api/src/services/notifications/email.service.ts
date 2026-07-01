import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

export async function sendBudgetAlertEmail(
  to: string,
  budgetName: string,
  threshold: number,
  percentUsed: number,
  spent: number,
  limit: number,
  currency: string
): Promise<void> {
  if (!env.SMTP_USER || !env.SMTP_PASS) return;

  const subject = `CloudLens Alert: Budget "${budgetName}" has reached ${threshold}%`;
  const html = `
    <div style="font-family: sans-serif; max-width: 480px;">
      <h2 style="color: #e11d48;">Budget Alert</h2>
      <p><strong>${budgetName}</strong> has exceeded the <strong>${threshold}%</strong> threshold.</p>
      <table style="border-collapse: collapse; width: 100%;">
        <tr><td style="padding: 8px; color: #666;">Spent</td><td style="padding: 8px;"><strong>${currency} ${spent.toLocaleString()}</strong></td></tr>
        <tr><td style="padding: 8px; color: #666;">Limit</td><td style="padding: 8px;"><strong>${currency} ${limit.toLocaleString()}</strong></td></tr>
        <tr><td style="padding: 8px; color: #666;">Usage</td><td style="padding: 8px;"><strong>${percentUsed}%</strong></td></tr>
      </table>
    </div>
  `;

  await getTransporter().sendMail({
    from: env.EMAIL_FROM,
    to,
    subject,
    html,
  });
}
