/**
 * @file pages/api/stripe/webhook.ts
 * @description
 *   Stripe → WiseGraph authoritative event bridge. This route accepts POSTed events from Stripe,
 *   verifies the signature using the raw HTTP body, and updates WiseGraph’s user subscription state
 *   accordingly via your existing `UserService`. It explicitly runs with body parsing disabled to
 *   preserve the raw payload for signature verification. The handler is intentionally independent of
 *   NextAuth to avoid blocking billing state changes on app auth—Stripe is the source of truth here.
 *
 *   Events handled:
 *     - checkout.session.completed → mark user premium, persist stripeCustomerId/subscriptionId.
 *     - customer.subscription.updated/deleted → reflect status; downgrade to freemium on cancel/ended.
 *     - invoice.payment_failed → optional: could flag banner; we log for observability.
 *
 *   Security:
 *     - Verifies Stripe-Signature header using STRIPE_WEBHOOK_SECRET.
 *     - Never trusts client-provided user IDs; matches on session.customer details / email.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { verifyWebhook, retrieveSubscription } from '@/app/src/billing/stripeAdapter';
import { UserService } from '@/app/src/services/userService';
import { firestore } from '@/app/src/services/firebase';
import type { BillingSnapshot } from '@/app/src/billing/types';
import { getPlanInterval } from '@/app/src/billing/priceCatalog';

export const config = {
  api: { bodyParser: false },
};

async function readRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Step 1 — Method guard.
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  // Step 2 — Get raw body and signature.
  const sig = (req.headers['stripe-signature'] as string | undefined) || null;
  const raw = await readRawBody(req);

  let event: Stripe.Event;
  try {
    event = verifyWebhook(raw, sig);
  } catch (err: any) {
    console.error('[webhook] Signature verification failed:', err?.message);
    return res.status(400).send(`Webhook Error: ${err?.message ?? 'Bad signature'}`);
  }

  // Step 3 — Switch by event type.
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const subId = session.subscription as string | undefined;
        const customerId = session.customer as string | undefined;
       
        // Prefer email from session; fall back to customer_details if needed.
        const email =
          (session.customer_details && session.customer_details.email) ||
          (session.customer_email as string | undefined);

        if (!email) {
          console.warn('[webhook] checkout.session.completed without email; cannot map user.');
          break;
        }


        if (subId) {
            const snap = await retrieveSubscription(subId);
            
            // Define Price IDs for both tiers from Environment
            const educatorPrices = [
                process.env.PRICE_EDUCATOR_MONTHLY, 
                process.env.PRICE_EDUCATOR_ANNUAL
            ].filter(Boolean);

            const scholarPrices = [
                process.env.PRICE_SCHOLAR_MONTHLY, 
                process.env.PRICE_SCHOLAR_ANNUAL
            ].filter(Boolean);

            if (snap.priceId) 
            {
            // Strict Enforcement Logic
            if (educatorPrices.includes(snap.priceId)) {
                console.log(`[webhook] Enforcing user ${email} to 'educator' based on priceId ${snap.priceId}`);
                await UserService.updateAccountType(email, 'educator');
            } else if (scholarPrices.includes(snap.priceId)) {
                console.log(`[webhook] Enforcing user ${email} to 'scholar' based on priceId ${snap.priceId}`);
                await UserService.updateAccountType(email, 'scholar');
            }
        }
      }

        // Normalize: mark user premium and persist subscriptionId.
        await UserService.updateSubscriptionTier(email, 'premium', subId);

        // Also persist stripeCustomerId for future portal access (merge write).
        if (customerId) {
          await firestore.collection('users').doc(email.toLowerCase()).set(
            { stripeCustomerId: customerId },
            { merge: true }
          );
        }
        const event_log = {session , subId, customerId}
        console.log(`bloom-maps\pages\api\stripe\webhook.ts [8000] ${JSON.stringify(event_log)}`)
        // 3.3 Build and write the minimal billing snapshot (already using adapter) — unchanged.
        if (subId) {
          const snap = await retrieveSubscription(subId);
          const billing: BillingSnapshot = {
            status: snap.status,
            productId: snap.productId,
            priceId: snap.priceId,
            interval: getPlanInterval(snap.priceId),
            currentPeriodEnd: snap.currentPeriodEnd,
            cancelAtPeriodEnd: snap.cancelAtPeriodEnd,
            lastEventAt: Date.now(),
          };
          console.log(`bloom-maps\pages\api\stripe\webhook.ts [8000] ${JSON.stringify(billing)}`)

          
          await UserService.updateBillingSnapshot(email, billing);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        // Lookup the app user by stored customerId (written during checkout completion).
        const users = await firestore.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
        if (!users.empty) {
          const doc = users.docs[0];
          const email = doc.id;

          // Keep premium for active/trialing/past_due; downgrade for canceled/unpaid/incomplete_expired
          if (sub.status === 'canceled' || sub.status === 'unpaid' || sub.status === 'incomplete_expired') {
            await UserService.updateSubscriptionTier(email, 'freemium');
          } else if (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due') {
            await UserService.updateSubscriptionTier(email, 'premium', sub.id);
          }

          // Build minimal billing snapshot from live subscription
          const item = sub.items?.data?.[0];
          const priceId = item?.price?.id ?? null;
          const productId = (item?.price?.product as string) ?? null;

          /* update - 1: pull normalized period fields from adapter to avoid sub.current_period_end */
          const snap = await retrieveSubscription(sub.id);

          const billing: BillingSnapshot = {
            status: sub.status as BillingSnapshot['status'],
            productId: productId ?? snap.productId,
            priceId: priceId ?? snap.priceId,
            interval: getPlanInterval(priceId ?? snap.priceId),
            currentPeriodEnd: snap.currentPeriodEnd,          
            cancelAtPeriodEnd: snap.cancelAtPeriodEnd,      
            lastEventAt: Date.now(),
          };

          await UserService.updateBillingSnapshot(email, billing);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        const users = await firestore.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
        if (!users.empty) {
          const doc = users.docs[0];
          const email = doc.id;

          await UserService.updateSubscriptionTier(email, 'freemium');
          await firestore.collection('users').doc(email).set(
            { stripeSubscriptionId: null },
            { merge: true }
          );

          // Write final snapshot reflecting cancellation
          const item = sub.items?.data?.[0];
          const priceId = item?.price?.id ?? null;
          const productId = (item?.price?.product as string) ?? null;

          /* update - 2: pull normalized period fields from adapter to avoid sub.current_period_end */
          const snap = await retrieveSubscription(sub.id);

          const billing: BillingSnapshot = {
            status: 'canceled',
            productId: productId ?? snap.productId,
            priceId: priceId ?? snap.priceId,
            interval: getPlanInterval(priceId ?? snap.priceId),
            currentPeriodEnd: snap.currentPeriodEnd,          // update - 2
            cancelAtPeriodEnd: snap.cancelAtPeriodEnd,        // update - 2
            lastEventAt: Date.now(),
          };
          await UserService.updateBillingSnapshot(email, billing);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string | undefined;
        console.warn('[webhook] invoice.payment_failed', { customerId, invoiceId: invoice.id });
        // Optional: mark banner for account, send email, etc.
        break;
      }

      default: {
        // For visibility; keep webhook lenient on unhandled events.
        console.log('[webhook] Unhandled event type:', event.type);
      }
    }

    return res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('[webhook] Handler error:', err?.message, err?.stack);
    return res.status(500).json({ error: 'Webhook handling error' });
  }
}
