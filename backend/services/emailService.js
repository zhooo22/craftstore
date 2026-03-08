// backend/services/emailService.js
// ─────────────────────────────────────────────────────────────────────────────
// Nodemailer email service.
// In development (NODE_ENV !== 'production') emails are printed to console.
// In production, configure real SMTP credentials in .env
// ─────────────────────────────────────────────────────────────────────────────

const nodemailer = require('nodemailer');

// Create transporter (falls back to console logging if no SMTP config)
let transporter;

const createTransporter = () => {
  if (process.env.NODE_ENV === 'production' && process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  } else {
    // Dev: log to console
    transporter = {
      sendMail: async (opts) => {
        console.log('\n📧 ─── MOCK EMAIL ───────────────────────────────────');
        console.log(`  To:      ${opts.to}`);
        console.log(`  Subject: ${opts.subject}`);
        console.log(`  Body:    ${opts.text || '(html only)'}`);
        console.log('─────────────────────────────────────────────────────\n');
        return { messageId: `mock-${Date.now()}` };
      },
    };
  }
};
createTransporter();

// ── Email Templates ───────────────────────────────────────────────────────────

const brandColor = '#C4714A';
const html = (body) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Georgia, serif; background: #F5EFE6; color: #3A2E27; margin: 0; padding: 0; }
    .container { max-width: 580px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; border: 1px solid #D9CFC2; }
    .header { background: ${brandColor}; padding: 32px; text-align: center; color: white; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 400; letter-spacing: 0.02em; }
    .header p { margin: 8px 0 0; opacity: 0.85; font-size: 14px; }
    .body { padding: 32px; }
    .footer { background: #F5EFE6; padding: 20px 32px; text-align: center; font-size: 12px; color: #8B7B72; }
    .btn { display: inline-block; background: ${brandColor}; color: white !important; padding: 12px 28px; border-radius: 4px; text-decoration: none; font-size: 14px; margin: 16px 0; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    td, th { padding: 10px 12px; border-bottom: 1px solid #EDE3D5; font-size: 14px; text-align: left; }
    th { background: #F5EFE6; font-weight: 600; }
    .total-row td { font-weight: 700; font-size: 16px; border-top: 2px solid #D9CFC2; }
    .tag { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px; }
  </style>
</head>
<body><div class="container">${body}</div></body>
</html>`;

// ── Exported Email Functions ───────────────────────────────────────────────────

/**
 * Send order confirmation email to customer
 */
exports.sendOrderConfirmation = async ({ order, items, user }) => {
  const itemRows = items.map(i => `
    <tr>
      <td>${i.product_image} ${i.product_name}</td>
      <td style="text-align:center">${i.quantity}</td>
      <td style="text-align:right">$${(i.price * i.quantity).toFixed(2)}</td>
    </tr>`).join('');

  const body = `
    <div class="header">
      <h1>🌿 The Crafted Nest</h1>
      <p>Your order is confirmed!</p>
    </div>
    <div class="body">
      <p>Hi ${user.name},</p>
      <p>Thank you for your order. We're preparing your handcrafted goods with care.</p>
      <h3 style="margin-top:24px">Order <span style="color:${brandColor}">${order.id}</span></h3>
      <table>
        <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th></tr></thead>
        <tbody>${itemRows}</tbody>
        <tfoot>
          <tr><td colspan="2">Subtotal</td><td style="text-align:right">$${order.subtotal.toFixed(2)}</td></tr>
          <tr><td colspan="2">Tax (8%)</td><td style="text-align:right">$${order.tax.toFixed(2)}</td></tr>
          <tr><td colspan="2">Shipping</td><td style="text-align:right">${order.shipping_fee === 0 ? 'Free' : '$' + order.shipping_fee.toFixed(2)}</td></tr>
          <tr class="total-row"><td colspan="2">Total</td><td style="text-align:right;color:${brandColor}">$${order.total.toFixed(2)}</td></tr>
        </tfoot>
      </table>
      <h3>Shipping Address</h3>
      <p style="font-size:14px;color:#8B7B72">
        ${order.ship_name}<br>
        ${order.ship_address}, ${order.ship_city}, ${order.ship_state} ${order.ship_zip}<br>
        ${order.ship_phone}
      </p>
      <div style="background:#F5EFE6;padding:16px;border-radius:8px;margin-top:20px">
        <strong>💵 Payment: Cash on Delivery</strong><br>
        <span style="font-size:13px;color:#8B7B72">Please have $${order.total.toFixed(2)} ready when your order arrives.</span>
      </div>
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} The Crafted Nest · Made with 🤍 for mindful living
    </div>`;

  return transporter.sendMail({
    from: process.env.EMAIL_FROM || '"The Crafted Nest" <noreply@craftednest.com>',
    to: user.email,
    subject: `Your Order ${order.id} is Confirmed 🌿`,
    text: `Hi ${user.name}, your order ${order.id} has been confirmed. Total: $${order.total.toFixed(2)}. Payment: Cash on Delivery.`,
    html: html(body),
  });
};

/**
 * Send order status update email
 */
exports.sendOrderStatusUpdate = async ({ order, user }) => {
  const statusEmoji = { pending: '⏳', processing: '🔨', shipped: '🚚', delivered: '✅', cancelled: '❌' };
  const emoji = statusEmoji[order.status] || '📦';

  const body = `
    <div class="header">
      <h1>🌿 The Crafted Nest</h1>
      <p>Order Update</p>
    </div>
    <div class="body">
      <p>Hi ${user.name},</p>
      <p>Your order <strong>${order.id}</strong> has been updated:</p>
      <div style="text-align:center;padding:24px">
        <div style="font-size:48px">${emoji}</div>
        <p style="font-size:22px;font-family:Georgia;margin:12px 0;text-transform:capitalize">${order.status}</p>
      </div>
    </div>
    <div class="footer">© ${new Date().getFullYear()} The Crafted Nest</div>`;

  return transporter.sendMail({
    from: process.env.EMAIL_FROM || '"The Crafted Nest" <noreply@craftednest.com>',
    to: user.email,
    subject: `Order ${order.id} — Status Updated to ${order.status} ${emoji}`,
    text: `Hi ${user.name}, your order ${order.id} status has been updated to: ${order.status}.`,
    html: html(body),
  });
};

/**
 * Send password reset email
 */
exports.sendPasswordReset = async ({ user, resetUrl }) => {
  const body = `
    <div class="header">
      <h1>🌿 The Crafted Nest</h1>
      <p>Password Reset</p>
    </div>
    <div class="body">
      <p>Hi ${user.name},</p>
      <p>You requested a password reset. Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
      <div style="text-align:center">
        <a href="${resetUrl}" class="btn">Reset My Password</a>
      </div>
      <p style="font-size:13px;color:#8B7B72">If you didn't request this, you can safely ignore this email. Your password won't change.</p>
      <p style="font-size:12px;color:#8B7B72;word-break:break-all">Or paste this URL: ${resetUrl}</p>
    </div>
    <div class="footer">© ${new Date().getFullYear()} The Crafted Nest</div>`;

  return transporter.sendMail({
    from: process.env.EMAIL_FROM || '"The Crafted Nest" <noreply@craftednest.com>',
    to: user.email,
    subject: 'Reset your Crafted Nest password',
    text: `Hi ${user.name}, reset your password here: ${resetUrl} (expires in 1 hour)`,
    html: html(body),
  });
};
