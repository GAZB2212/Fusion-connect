import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
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
  return {apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email};
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
export async function getUncachableResendClient() {
  const {apiKey} = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail: connectionSettings.settings.from_email
  };
}

export async function sendPasswordResetEmail(to: string, resetToken: string, userName: string) {
  const { client, fromEmail } = await getUncachableResendClient();
  
  const resetUrl = `${process.env.REPLIT_DEV_DOMAIN ? 'https://' + process.env.REPLIT_DEV_DOMAIN : 'http://localhost:5000'}/reset-password?token=${resetToken}`;
  
  await client.emails.send({
    from: fromEmail,
    to,
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
}
