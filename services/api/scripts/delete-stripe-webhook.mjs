/** One-off: delete Stripe webhook endpoint by ID. Usage: STRIPE_SECRET_KEY=sk_live_... node delete-stripe-webhook.mjs [endpoint_id] */
const id = process.argv[2] || 'we_1TmXnMRs7lnwzITHr5p8IJ3Z';
const sk = process.env.STRIPE_SECRET_KEY;
if (!sk) {
  console.error('STRIPE_SECRET_KEY required');
  process.exit(1);
}
const r = await fetch(`https://api.stripe.com/v1/webhook_endpoints/${id}`, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${sk}` },
});
console.log('delete status', r.status);
