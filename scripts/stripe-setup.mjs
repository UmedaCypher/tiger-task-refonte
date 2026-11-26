// Crée en une fois le produit, les 4 prix, les 2 coupons et le webhook Stripe de Tiger Task.
// Usage : STRIPE_SECRET_KEY=sk_test_... APP_URL=https://ton-domaine node scripts/stripe-setup.mjs
// Affiche les variables à coller dans Cloudflare. À lancer une fois en mode test, une fois en mode live.

const key = process.env.STRIPE_SECRET_KEY;
const appUrl = process.env.APP_URL;
if (!key) {
  console.error('STRIPE_SECRET_KEY manquant');
  process.exit(1);
}

async function stripe(path, params) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${path} : ${data.error?.message}`);
  return data;
}

const product = await stripe('products', { name: 'Tiger Task Pro', description: 'Toute ton année, sur tous tes appareils.' });
const price = (amount, extra) =>
  stripe('prices', { product: product.id, currency: 'eur', unit_amount: String(amount), tax_behavior: 'inclusive', ...extra });

const monthly = await price(399, { 'recurring[interval]': 'month', nickname: 'Mensuel 3,99 €' });
const yearly = await price(2990, { 'recurring[interval]': 'year', nickname: 'Annuel 29,90 €' });
const lifetime = await price(7990, { nickname: 'À vie 79,90 €' });
const founder = await price(5990, { nickname: 'À vie Fondateurs 59,90 €' });

const downsell = await stripe('coupons', { name: 'Bienvenue : 19,90 € la 1re année', amount_off: '1000', currency: 'eur', duration: 'once' });
const lifetimeRef = await stripe('coupons', { name: 'Recommandé par un ami : -10 %', percent_off: '10', duration: 'once' });

let webhookSecret = '(crée le webhook à la main, voir README)';
if (appUrl) {
  const events = [
    'checkout.session.completed',
    'invoice.paid',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'charge.refunded',
  ];
  const params = { url: `${appUrl.replace(/\/$/, '')}/api/stripe-webhook`, description: 'Tiger Task' };
  events.forEach((e, i) => (params[`enabled_events[${i}]`] = e));
  const wh = await stripe('webhook_endpoints', params);
  webhookSecret = wh.secret;
}

console.log(`
Variables à ajouter dans Cloudflare › tiger-task › Settings › Variables and secrets :

STRIPE_PRICE_MONTHLY=${monthly.id}
STRIPE_PRICE_YEARLY=${yearly.id}
STRIPE_PRICE_LIFETIME=${lifetime.id}
STRIPE_PRICE_LIFETIME_FOUNDER=${founder.id}
STRIPE_COUPON_DOWNSELL=${downsell.id}
STRIPE_COUPON_LIFETIME_REF=${lifetimeRef.id}
STRIPE_WEBHOOK_SECRET=${webhookSecret}   (secret)
`);
