/**
 * @file pages/api/share/send-email.ts
 * @responsibility
 *   • Validate incoming email & URL payload.
 *   • Send the invite-link email via SendGrid.
 *   • Return JSON { ok: true } on success, or error details on failure.
 *   • Log key steps (5101–5104) for observability.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('send-email.ts 5101 ○ Request body:', req.body);

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { email, url } = req.body as { email?: string; url?: string };

  // Basic validation
  if (!email || typeof email !== 'string' || !email.includes('@') || !url || typeof url !== 'string') {
    console.warn('send-email.ts 5102 ✖ Invalid payload', req.body);
    return res.status(400).json({ error: 'Invalid email or URL' });
  }

  try {
    const msg = {
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL!,
      subject: 'Your StudyConnect Invite Link',
      text: `Here’s your link to join on desktop:\n\n${url}`,
      html: `<p>Here’s your link to join on desktop:</p><p><a href="${url}">${url}</a></p>`,
    };

    console.log('send-email.ts 5103 ○ Sending email via SendGrid:', msg);
    await sgMail.send(msg);
    console.log('send-email.ts 5104 ○ Email sent successfully to', email);

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('send-email.ts 5105 ✖ SendGrid error:', err);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}
