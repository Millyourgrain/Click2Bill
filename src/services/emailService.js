/**
 * Send email via Cloudflare Worker + Resend.
 * Requires user to be authenticated (Firebase token sent in Authorization header).
 */
import { auth } from '../firebase/config';

const getApiBase = () => {
  if (import.meta.env.DEV) return 'http://localhost:8787';
  return window.location.origin;
};

/**
 * Send an email through the platform.
 * @param {{ to: string, subject: string, text?: string, html?: string }} payload
 * @returns {{ success: boolean, error?: string }}
 */
export const sendEmail = async ({ to, subject, text, html }) => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'Not logged in' };

    const token = await user.getIdToken(true);
    const base = getApiBase();
    const res = await fetch(`${base}/api/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ to: to.trim(), subject, text, html }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to send email' };
    }
    return { success: true };
  } catch (e) {
    console.error('sendEmail error:', e);
    return { success: false, error: e?.message || 'Failed to send email' };
  }
};
