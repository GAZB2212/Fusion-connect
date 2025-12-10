import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  // Prefer RESEND_API_KEY secret if available (more reliable than connector)
  if (process.env.RESEND_API_KEY) {
    console.log('[Email] Using RESEND_API_KEY from secrets');
    return { 
      apiKey: process.env.RESEND_API_KEY, 
      fromEmail: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev' 
    };
  }

  // Fallback to Resend connector
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('Neither RESEND_API_KEY nor Resend connector found');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  
  console.log('[Email] Using Resend connector');
  return {
    apiKey: connectionSettings.settings.api_key, 
    fromEmail: connectionSettings.settings.from_email
  };
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
export async function getUncachableResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail: fromEmail
  };
}

export async function sendPasswordResetEmail(to: string, resetToken: string, userName: string) {
  console.log(`[Email] Attempting to send password reset email to ${to}`);
  const { client, fromEmail } = await getUncachableResendClient();
  console.log(`[Email] Using from email: ${fromEmail}`);
  
  // Use production domain if available, otherwise dev domain
  const domain = process.env.REPLIT_DOMAINS 
    ? 'https://' + process.env.REPLIT_DOMAINS.split(',')[0]
    : process.env.REPLIT_DEV_DOMAIN 
      ? 'https://' + process.env.REPLIT_DEV_DOMAIN 
      : 'http://localhost:5000';
  const resetUrl = `${domain}/reset-password?token=${resetToken}`;
  console.log(`[Email] Reset URL: ${resetUrl}`);
  
  const result = await client.emails.send({
    from: fromEmail,
    to: [to],
    subject: 'Reset Your Fusion Password',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Inter, sans-serif; background-color: #0A0E17; color: #F8F4E3; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 40px auto; padding: 40px; background: #1A1E27; border-radius: 12px; }
            .logo { text-align: center; margin-bottom: 30px; }
            .logo h1 { color: #D4AF37; font-size: 32px; margin: 0; }
            .content { line-height: 1.6; }
            .button { display: inline-block; background-color: #D4AF37; color: #0A0E17; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #2A2E37; color: #9CA3AF; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <h1>🌙 Fusion</h1>
            </div>
            <div class="content">
              <h2 style="color: #F8F4E3;">Reset Your Password</h2>
              <p>Hello${userName ? ' ' + userName : ''},</p>
              <p>We received a request to reset your password for your Fusion account. Click the button below to create a new password:</p>
              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </div>
              <p>Or copy and paste this link into your browser:</p>
              <p style="color: #9CA3AF; word-break: break-all;">${resetUrl}</p>
              <p><strong>This link will expire in 1 hour.</strong></p>
              <p>If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.</p>
            </div>
            <div class="footer">
              <p>Fusion - Premium Muslim Matchmaking</p>
              <p>This is an automated email. Please do not reply.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  });
  
  console.log(`[Email] Send result:`, JSON.stringify(result, null, 2));
  
  if (result.error) {
    console.error(`[Email] Failed to send email:`, result.error.message);
    throw new Error(result.error.message);
  }
  
  console.log(`[Email] Email sent successfully, id:`, result.data?.id);
  return result;
}

export async function sendEarlyAccessEmail(to: string, firstName: string | null, promoCode: string, position: number) {
  console.log(`[Email] Attempting to send early access email to ${to}`);
  const { client, fromEmail } = await getUncachableResendClient();
  console.log(`[Email] Using from email: ${fromEmail}`);
  
  const result = await client.emails.send({
    from: fromEmail,
    to: [to],
    subject: 'Welcome to Fusion - Your Exclusive Promo Code Inside!',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Inter, sans-serif; background-color: #0A0E17; color: #F8F4E3; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 40px auto; padding: 40px; background: #1A1E27; border-radius: 12px; }
            .logo { text-align: center; margin-bottom: 30px; }
            .logo h1 { color: #D4AF37; font-size: 36px; margin: 0; font-family: serif; }
            .content { line-height: 1.6; }
            .promo-box { background: linear-gradient(135deg, #D4AF37 0%, #B8962E 100%); color: #0A0E17; padding: 24px; border-radius: 12px; text-align: center; margin: 24px 0; }
            .promo-code { font-size: 28px; font-weight: bold; font-family: monospace; letter-spacing: 2px; margin: 8px 0; }
            .highlight { color: #D4AF37; font-weight: 600; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #2A2E37; color: #9CA3AF; font-size: 14px; text-align: center; }
            .benefits { background: #0E1220; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .benefit-item { display: flex; align-items: flex-start; margin: 12px 0; }
            .check { color: #10B981; margin-right: 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <h1 style="font-family: 'Playfair Display', Georgia, serif; font-size: 42px; font-weight: 700; color: #D4AF37; margin: 0; letter-spacing: 2px;">Fusion</h1>
              <p style="color: #9CA3AF; margin: 10px 0 0 0; font-size: 14px;">Premium Muslim Matchmaking</p>
            </div>
            <div class="content">
              <h2 style="color: #F8F4E3; text-align: center;">You're In! 🎉</h2>
              <p>Assalamu Alaikum${firstName ? ' ' + firstName : ''},</p>
              <p>Thank you for joining the Fusion waitlist! You're one of the first <span class="highlight">${position.toLocaleString()}</span> people to sign up.</p>
              
              <div class="promo-box">
                <p style="margin: 0 0 8px 0; font-size: 14px;">Your Exclusive Promo Code</p>
                <div class="promo-code">${promoCode}</div>
                <p style="margin: 8px 0 0 0; font-size: 14px;">Save this code for 2 MONTHS FREE premium access!</p>
              </div>
              
              <div class="benefits">
                <p style="margin: 0 0 12px 0; font-weight: 600;">What you'll get with premium:</p>
                <div class="benefit-item">
                  <span class="check">✓</span>
                  <span>Unlimited messaging with your matches</span>
                </div>
                <div class="benefit-item">
                  <span class="check">✓</span>
                  <span>Video calling to meet face-to-face</span>
                </div>
                <div class="benefit-item">
                  <span class="check">✓</span>
                  <span>Chaperone support for halal courtship</span>
                </div>
                <div class="benefit-item">
                  <span class="check">✓</span>
                  <span>Advanced filters and preferences</span>
                </div>
              </div>
              
              <p>We'll email you as soon as Fusion launches. Get ready to find your perfect match, the halal way.</p>
              
              <p style="color: #9CA3AF; font-size: 14px;">Keep this email safe - you'll need your promo code when we launch!</p>
            </div>
            <div class="footer">
              <p>Fusion - Where Faith Meets Forever</p>
              <p style="font-size: 12px; color: #6B7280;">© 2025 Fusion. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  });
  
  console.log(`[Email] Send result:`, JSON.stringify(result, null, 2));
  
  if (result.error) {
    console.error(`[Email] Failed to send early access email:`, result.error.message);
    throw new Error(result.error.message);
  }
  
  console.log(`[Email] Early access email sent successfully, id:`, result.data?.id);
  return result;
}

export async function sendChaperoneInvitationEmail(
  to: string, 
  chaperoneName: string, 
  userName: string, 
  relationshipType: string | null,
  accessLink: string,
  accessType: 'live' | 'report'
) {
  console.log(`[Email] Sending chaperone invitation email to ${to}`);
  const { client, fromEmail } = await getUncachableResendClient();
  
  const isLiveAccess = accessType === 'live';
  const accessDescription = isLiveAccess 
    ? 'You have been granted <strong>Live Access</strong>, which means you can view and participate in all conversations in real-time.'
    : 'You have been granted <strong>Report Access</strong>, which means you will receive periodic email summaries of conversations.';
  
  const result = await client.emails.send({
    from: fromEmail,
    to: [to],
    subject: `You've Been Added as a Chaperone on Fusion`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Inter, sans-serif; background-color: #0A0E17; color: #F8F4E3; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 40px auto; padding: 40px; background: #1A1E27; border-radius: 12px; }
            .logo { text-align: center; margin-bottom: 30px; }
            .logo h1 { color: #D4AF37; font-size: 32px; margin: 0; }
            .content { line-height: 1.6; }
            .button { display: inline-block; background-color: #D4AF37; color: #0A0E17; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
            .access-box { background: #0E1220; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${isLiveAccess ? '#10B981' : '#3B82F6'}; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #2A2E37; color: #9CA3AF; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <h1 style="font-family: 'Playfair Display', Georgia, serif; font-size: 36px; font-weight: 700; color: #D4AF37; margin: 0; letter-spacing: 2px;">Fusion</h1>
              <p style="color: #9CA3AF; margin: 10px 0 0 0; font-size: 14px;">Premium Muslim Matchmaking</p>
            </div>
            <div class="content">
              <h2 style="color: #F8F4E3;">Assalamu Alaikum ${chaperoneName},</h2>
              <p><strong>${userName}</strong> has added you as their chaperone${relationshipType ? ` (${relationshipType})` : ''} on Fusion, a premium Muslim matchmaking platform.</p>
              
              <div class="access-box">
                <p style="margin: 0;">${accessDescription}</p>
              </div>
              
              ${isLiveAccess ? `
              <p>As a chaperone with live access, you can oversee conversations to ensure they remain respectful and halal. Click the button below to access the Chaperone Portal:</p>
              
              <div style="text-align: center;">
                <a href="${accessLink}" class="button">Access Chaperone Portal</a>
              </div>
              
              <p style="color: #9CA3AF; font-size: 14px;">Or copy and paste this link into your browser:</p>
              <p style="color: #9CA3AF; word-break: break-all; font-size: 12px;">${accessLink}</p>
              ` : `
              <p>As a chaperone with report access, you will receive periodic email summaries of ${userName}'s conversations. This allows you to stay informed while respecting privacy.</p>
              `}
              
              <p style="margin-top: 24px;">Thank you for supporting ${userName} on their journey to finding a meaningful connection.</p>
            </div>
            <div class="footer">
              <p>Fusion - Where Faith Meets Forever</p>
              <p style="font-size: 12px; color: #6B7280;">This email was sent because ${userName} added you as their chaperone. If you believe this was sent in error, please contact them directly.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  });
  
  if (result.error) {
    console.error(`[Email] Failed to send chaperone invitation:`, result.error.message);
    throw new Error(result.error.message);
  }
  
  console.log(`[Email] Chaperone invitation sent successfully, id:`, result.data?.id);
  return result;
}
