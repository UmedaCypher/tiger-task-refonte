# Tiger Task — le carnet du tigre

> Chaque jour, des tâches. Chaque tâche, une couleur. Chaque année, une tapisserie.

Une app de to-do list inspirée de la méthode d’organisation de **Fibre Tigre** (ses billets « Mon emploi du temps » 2016 → 2019) :
une liste par jour, et chaque soir un verdict — une couleur par tâche.

| Couleur | Nom | Sens |
|---|---|---|
| ⚪ | Page blanche | À faire |
| 🟢 | Jade | Faite |
| 🔵 | Azur | Tâche qui traînait, enfin faite |
| 🟡 | Safran | Reportée à demain, par flemme → **renaît le lendemain** |
| 🟣 | Améthyste | Reportée, indépendamment de ma volonté → **renaît le lendemain** |
| 🔴 | Vermillon | Pas faite, par flemme (culpabilité) |
| ⚫ | Encre | Échec cuisant et triste |

## Ce que fait l’app

- **Jour** : la page du jour, un ruban de la semaine, un vers par jour. Toucher un sceau = faite (azur automatiquement si la tâche avait été reportée). Toucher l’intitulé = palette des 7 couleurs, renommer, effacer.
- **Reports** : safran et améthyste recopient la tâche au lendemain avec son compteur (↷ 2). Revenir sur ce choix efface le report s’il n’a pas été touché.
- **Verdict** : un bandeau rappelle les journées passées dont des tâches n’ont pas reçu de couleur.
- **Rituels** : tâches récurrentes par jour de semaine, qui s’inscrivent seules.
- **Tapisserie** : l’année entière, 12 rangs × 31 jours, chaque jour tissé des couleurs de ses tâches (la vue « Excel » de Fibre Tigre).
- **Bilan** : taux d’accomplissement, indice de flemme (safran + vermillon), séries, mois par mois, et ta Némésis (la tâche la plus reportée).
- **Compte** : connexion Supabase (lien magique ou Google), synchronisation, Pacte du Tigre (abonnement Stripe), export JSON.
- **PWA** : installable sur iOS/Android, fonctionne hors ligne (polices embarquées).

## Architecture

```
Cloudflare Pages  ──  front statique (Vite + React + TS, PWA)
   └─ functions/api/   Pages Functions : checkout, portal, stripe-webhook (Stripe en REST, sans SDK)
Supabase           ──  Auth + Postgres (tables tasks, rituals, profiles, RLS par utilisateur)
```

- **Local-first** : tout s’écrit d’abord dans le navigateur (`src/lib/store.ts`). Sans Supabase configuré, l’app est 100 % locale.
- **Sync** (`src/lib/sync.ts`) : pousse les éléments modifiés, tire ce qui a changé côté serveur (`synced_at` horodaté par Postgres). Conflits : la modification la plus récente gagne (aussi garanti par un trigger SQL).

## Démarrer en local

```bash
npm install
cp .env.example .env.local     # optionnel : clés Supabase
npm run dev                    # http://localhost:5173
```

Pour tester aussi les fonctions Stripe : `cp .dev.vars.example .dev.vars`, puis `npm run build && npm run pages:dev`.

## Mise en place Supabase

1. Créer un projet sur supabase.com.
2. SQL Editor → coller `supabase/migrations/0001_init.sql` → Run.
3. Authentication → URL Configuration : ajouter l’URL Cloudflare Pages (et `http://localhost:5173`) en *Redirect URLs*.
4. (Optionnel) Authentication → Providers → Google.
5. Récupérer `Project URL` et `anon key` → `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.

## Mise en place Stripe (Pacte du Tigre)

1. Créer un produit avec deux prix récurrents (mensuel, annuel) → `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`.
2. Webhook vers `https://<ton-domaine>/api/stripe-webhook`, événements : `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted` → `STRIPE_WEBHOOK_SECRET`.
3. Activer le portail client (Settings → Billing → Customer portal).
4. Les prix affichés sont dans `src/components/Account.tsx` (`PRICES`).
5. `VITE_SYNC_REQUIRES_PREMIUM=true` réserve la synchronisation aux abonnés.

## Déploiement Cloudflare Pages

Dashboard → Workers & Pages → Create → Pages → connecter ce dépôt GitHub :

- Build command : `npm run build`
- Output directory : `dist`
- Variables (Production) :
  - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SYNC_REQUIRES_PREMIUM`
  - Secrets : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`, `APP_URL`

Chaque push sur `main` redéploie ; chaque branche a son URL de prévisualisation.

## Feuille de route

- [ ] Widgets d’écran d’accueil : emballer l’app avec **Capacitor**, puis widget natif (iOS WidgetKit / Android Glance) qui lit les tâches du jour depuis Supabase.
- [ ] Notifications du soir (« l’heure du verdict »).
- [ ] Réordonner les tâches par glisser-déposer.
- [ ] Export de la tapisserie en image.
