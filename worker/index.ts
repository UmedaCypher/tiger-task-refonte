import { markPaid, overview, saveKr, saveOkr } from './admin';
import { claim, event, join, me, payoutDetails, referralLink } from './affiliate';
import { checkout, offers, portal, webhook } from './billing';
import { bad, type Env } from './shared';

type Handler = (req: Request, env: Env) => Promise<Response>;

const routes: Record<string, Handler> = {
  'GET /api/offers': (_r, env) => offers(env),
  'POST /api/checkout': checkout,
  'POST /api/portal': portal,
  'POST /api/stripe-webhook': webhook,
  'POST /api/referral/claim': claim,
  'GET /api/affiliate/me': me,
  'POST /api/affiliate/join': join,
  'POST /api/affiliate/payout': payoutDetails,
  'POST /api/event': event,
  'GET /api/admin/overview': overview,
  'POST /api/admin/okr': saveOkr,
  'POST /api/admin/kr': saveKr,
  'POST /api/admin/commissions/pay': markPaid,
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname.startsWith('/r/')) return referralLink(req, env, decodeURIComponent(url.pathname.slice(3)));

    if (url.pathname.startsWith('/api/')) {
      const handler = routes[`${req.method} ${url.pathname}`];
      if (!handler) return bad('Introuvable', 404);
      try {
        return await handler(req, env);
      } catch (e) {
        console.error(url.pathname, e);
        return bad('Une erreur est survenue. Réessaie dans un instant.', 500);
      }
    }

    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;
