# Tiger Task

> Une ligne par jour, une couleur par tâche.

Un seul Worker Cloudflare sert tout :

| Adresse | Quoi | Source |
|---|---|---|
| `/` | Le site : accueil, méthode, tarifs, FAQ, blog, affiliation, pages légales | `site/` (généré dans `web/`) |
| `/app/` | L’app (PWA, hors ligne) | `src/` |
| `/admin/` | Le back-office : revenus, utilisateurs, conversion, affiliés, OKR | `src/admin/` |
| `/api/*` | Paiement Stripe, affiliation, événements, admin | `worker/` |
| `/r/<code>` | Lien d’affilié (compte le clic, retient le code 60 jours) | `worker/affiliate.ts` |

Données : Supabase (comptes, synchronisation Pro, paiements, commissions, OKR). Paiement : Stripe.

## Offres

| | Prix TTC | Notes |
|---|---|---|
| Gratuit | 0 € | Toute la méthode ; les 30 derniers jours restent nets, les plus anciens sont floutés |
| Pro mensuel | 3,99 € | |
| Pro annuel | 29,90 € | Offre de rattrapage unique : 19,90 € la 1re année si on refuse l’offre |
| Pro à vie | 79,90 € | 59,90 € « Fondateurs » pour les 500 premiers |

Pro = tout l’historique, le bilan, la synchronisation, les futurs widgets.

**Affiliation** : 7 € par abonnement annuel (1re année seulement), 15 € par offre à vie, payables 30 jours après le paiement, virement dès 20 €. La personne recommandée a 30 jours offerts (mensuel et annuel) ou −10 % (à vie). Rien sur le mensuel, sauf passage à l’annuel dans les 60 jours. Les règles sont dans `worker/shared.ts` (`RULES`).

## Mise en route

### 1. Supabase
1. SQL Editor → coller `supabase/migrations/0001_init.sql` → Run (déjà fait si tu l’as passé).
2. SQL Editor → coller `supabase/migrations/0002_business.sql` → Run.
3. Te donner l’accès admin (remplace l’email, après t’être connecté une fois à l’app) :
   `update public.profiles set is_admin = true where id = (select id from auth.users where email = 'ton@email.fr');`
4. Authentication → URL Configuration : *Site URL* = ton adresse, et dans *Redirect URLs* ajoute `https://<ton-adresse>/app/` et `https://<ton-adresse>/admin/`.

### 2. Stripe
```bash
STRIPE_SECRET_KEY=sk_test_... APP_URL=https://<ton-adresse> npm run stripe:setup
```
Le script crée le produit, les 4 prix, les 2 coupons et le webhook, et affiche les variables à copier. Active aussi le portail client (Stripe › Settings › Billing › Customer portal). Refais-le avec la clé `sk_live_` le jour du lancement.

### 3. Cloudflare (Workers & Pages › tiger-task › Settings)
- **Build › Variables** (lues au build) : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Supprime `VITE_SYNC_REQUIRES_PREMIUM` (remplacée : la synchronisation fait partie de Pro).
- **Variables and secrets** (lues par le Worker) :
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (secret)
  - `STRIPE_SECRET_KEY` (secret), `STRIPE_WEBHOOK_SECRET` (secret)
  - `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`, `STRIPE_PRICE_LIFETIME`, `STRIPE_PRICE_LIFETIME_FOUNDER`
  - `STRIPE_COUPON_DOWNSELL`, `STRIPE_COUPON_LIFETIME_REF`
  - `APP_URL` (ton adresse), `STRIPE_TAX` = `on` pour laisser Stripe calculer la TVA du pays de l’acheteur

### 4. Le site
- Textes : `site/pages.mjs`. Nouvel article de blog : un fichier `.md` dans `site/blog/` (en-tête `title`, `description`, `date`).
- Domaine définitif : `SITE.url` dans `site/layout.mjs`.
- À compléter avant le lancement : les `[CROCHETS]` des pages légales (éditeur, SIREN, email de contact) et la FAQ, à faire relire.

## Développement
```bash
npm install
npm run dev        # site + app + admin sur http://localhost:5173 (sans l’API)
npm run worker:dev # tout, avec l’API (après npm run build, secrets dans .dev.vars)
npm run build
```

## Mesure
Événements anonymes (`/api/event`) : ouverture de l’app (1 par jour et par appareil), journée colorée, onboarding, paywall, offre de rattrapage. Jamais le contenu des tâches. Le back-office calcule les métriques depuis ces événements, les profils et les paiements.

## Feuille de route
- [ ] Widgets d’écran d’accueil (Capacitor + WidgetKit / Glance)
- [ ] Notification du soir (« l’heure du verdict »)
- [ ] Versements automatiques aux affiliés (Stripe Connect) quand le volume le justifie
