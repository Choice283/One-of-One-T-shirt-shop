// Sends internal alert emails to Choice (not customer-facing — Stripe already
// handles receipts and customer email automatically). Currently only used
// for Uber Direct delivery failures, see app/api/webhook/route.ts.
//
// Uses Resend (https://resend.com) — no domain verification needed as long
// as we're only sending to the account's own verified email address, which
// is all this alert does.

const RESEND_API_URL = 'https://api.resend.com/emails';

export async function sendDeliveryFailureAlert(params: {
  productId: string;
  productTitle: string;
  error: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.ALERT_EMAIL_TO;

  // Don't throw if alerting isn't configured — a missing/misconfigured
  // alert shouldn't ever break the webhook itself, just log and move on.
  if (!apiKey || !toEmail) {
    console.warn('Skipping delivery failure alert: RESEND_API_KEY or ALERT_EMAIL_TO not set');
    return;
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        // onboarding@resend.dev works out of the box with no domain setup,
        // as long as ALERT_EMAIL_TO is the same address you signed up to
        // Resend with.
        from: 'One-of-a-Kind Tees Alerts <onboarding@resend.dev>',
        to: [toEmail],
        subject: `Courier dispatch failed — ${params.productTitle}`,
        text:
          `Uber Direct delivery creation failed after payment succeeded.\n\n` +
          `Product: ${params.productTitle}\n` +
          `Product ID: ${params.productId}\n` +
          `Error: ${params.error}\n\n` +
          `The shirt is marked sold and paid for — you'll need to dispatch the courier ` +
          `manually from the Uber Direct dashboard, or check /admin for details.`
      })
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`Resend alert email failed (${res.status}): ${text}`);
    }
  } catch (err) {
    // Never let an alerting failure become a bigger problem — just log it.
    console.error('Failed to send delivery failure alert email:', err);
  }
}
