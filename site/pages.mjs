// Contenu des pages du site. Ton : on part de la douleur, on vend la transformation, jamais la fonctionnalité.
import { dayCard, tigerHead } from './layout.mjs';

const colors = [
  ['g', 'Faite', 'C’est fait. Bravo, champion.'],
  ['b', 'EPIC WIN', 'La dernière tâche d’un projet, la fin d’un long combat. Champagne.'],
  ['y', 'Flemme', 'Pas envie aujourd’hui. Demain, promis. Feignasse assumée : elle revient toute seule.'],
  ['p', 'Imprévu', 'Reportée, et pour une fois ce n’est pas ta faute.'],
  ['r', 'Abandonnée', 'Plus besoin, ou plus envie. On lâche, sans regret.'],
  ['k', 'EPIC FAIL', 'Un échec cuisant, légendaire. On en rira plus tard.'],
];

const pricingCards = (founderNote = true) => `
<div class="plans">
  <article class="plan">
    <h3>Gratuit</h3>
    <p class="plan-price">0 €</p>
    <p class="plan-for">Pour découvrir la méthode et l’adopter.</p>
    <ul>
      <li>La feuille du jour, les 7 couleurs, les reports</li>
      <li>Tes 30 derniers jours, nets et lisibles</li>
      <li>Rituels, mode nuit, mode Excel</li>
      <li>Sur tous tes appareils, même hors ligne</li>
    </ul>
    <a class="btn btn-ghost" href="/app/">Commencer gratuitement</a>
  </article>
  <article class="plan is-featured">
    <p class="plan-badge">Le plus choisi</p>
    <h3>Pro annuel</h3>
    <p class="plan-price">29,90 € <small>/ an</small></p>
    <p class="plan-for">Soit 2,49 € par mois, pour garder toute ton année.</p>
    <ul>
      <li>Chaque jour de ton année, et des suivantes</li>
      <li>Ton bilan : ce que tu fais vraiment de ton temps</li>
      <li>Tes statistiques et tes tâches les plus reportées</li>
      <li>Les widgets d’écran d’accueil, dès leur sortie</li>
    </ul>
    <a class="btn btn-primary" href="/app/?offre=annuel">Passer à Pro</a>
    <p class="plan-alt">Ou 3,99 € au mois, sans engagement.</p>
  </article>
  <article class="plan">
    <h3>Pro à vie</h3>
    <p class="plan-price">59,90 € <small>une fois</small></p>
    <p class="plan-for">${founderNote ? 'Prix Fondateurs, réservé aux 500 premiers. Ensuite 79,90 €.' : 'Payé une fois, à toi pour toujours.'}</p>
    <ul>
      <li>Tout Pro, pour toujours</li>
      <li>Aucun abonnement à surveiller</li>
      <li>Toutes les futures fonctionnalités</li>
    </ul>
    <a class="btn btn-ghost" href="/app/?offre=vie">Devenir Fondateur</a>
  </article>
</div>`;

export const home = {
  path: '/',
  title: 'Une ligne par jour, une couleur par tâche',
  description:
    'Arrête de courir après ta to-do list. Tiger Task : une ligne par jour, une couleur par tâche, et le soir tu sais enfin ce que tu as fait de ta journée.',
  body: `
<section class="hero hero-3d">
  <div class="hero-scene" aria-hidden="true">
    <div class="hero-sky"></div>
    <canvas class="hero-canvas"></canvas>
    <div class="hero-veil"></div>
    <div class="tiger-say"><p class="tiger-bubble">Zzz… Coche une tâche, ça me réveillera peut-être.</p></div>
  </div>
  <div class="hero-inner">
    <div class="hero-copy">
      <p class="eyebrow">La to-do list qui te roaste (gentiment)</p>
      <h1 class="words">Fais ta journée. <mark class="scribble">Puis sois libre.<svg viewBox="0 0 300 20" preserveAspectRatio="none" aria-hidden="true"><path d="M3 14 C 60 4, 120 18, 180 9 S 270 6, 297 12" pathLength="1"/></svg></mark></h1>
      <p class="lead">Une ligne par jour, une couleur par tâche. Un tigre qui dort tant que tu procrastines, et qui te chambre quand tu reportes. Plus vite tu finis, plus vite tu vas scroller l’esprit tranquille.</p>
      <div class="cta-row">
        <a class="btn btn-primary btn-lg" href="/app/">Commencer gratuitement</a>
        <a class="btn btn-ghost btn-lg" href="#comment">Comment ça marche</a>
      </div>
      <p class="fine">Gratuit, sans carte bancaire. Parfait comme page d’accueil de ton navigateur.</p>
    </div>
    <div class="hero-demo">${dayCard({ live: true })}</div>
  </div>
</section>

<div class="marquee" aria-hidden="true"><div class="track">
  ${['Trois reports. Elle a emménagé chez toi.', 'EPIC FAIL débloqué. Il fallait oser.', 'Tout est vert. Qui es-tu&nbsp;?', 'Flemme assumée. Demain, promis.', 'EPIC WIN. Champagne (avec modération).', 'Abandonnée. Parfois, lâcher, c’est grandir.', 'Page blanche. Ambitieux.', 'Ce n’est plus de la flemme, c’est de l’art.']
    .map((l, i) => `<span><i class="d-${'ykgybrwy'[i]}"></i>${l}</span>`)
    .join('')
    .repeat(2)}
</div></div>

<section class="pain">
  <div class="wrap narrow">
    <p class="eyebrow">Tu connais ça</p>
    <h2>Occupé toute la journée. Et pourtant, rien n’avance.</h2>
    <ul class="pain-list">
      <li class="reveal">Ta to-do list s’allonge plus vite que ta motivation.</li>
      <li class="reveal">Cette tâche, tu la reportes depuis trois semaines. Elle a sa brosse à dents chez toi.</li>
      <li class="reveal">Le soir, tu as été occupé toute la journée. À quoi&nbsp;? Mystère.</li>
      <li class="reveal">Tu as testé dix applis d’organisation. Surtout, tu as organisé des applis.</li>
    </ul>
    <p class="pain-turn reveal"><span class="pain-avatar">${tigerHead(40)}</span>Le problème n’est pas ta motivation. C’est que personne ne te dit la vérité sur tes journées. Nous, si. Avec tendresse.</p>
  </div>
</section>

<section class="change" id="transformation">
  <div class="wrap">
    <p class="eyebrow">Ce qui change</p>
    <h2>Pas une appli de plus. Une habitude qui te transforme.</h2>
    <ol class="timeline">
      <li class="reveal"><span>Jour 1</span><h3>Tu poses ta journée en deux minutes.</h3><p>Pas de projets, pas de priorités à calculer. Juste ce qui compte aujourd’hui, sur une ligne.</p></li>
      <li class="reveal"><span>Semaine 1</span><h3>Ta flemme a enfin un nom. Et une couleur.</h3><p>Le soir, chaque tâche reçoit son verdict. Jaune pour la flemme assumée, noir pour l’EPIC FAIL. Tu ris un peu, et tu fais mieux le lendemain.</p></li>
      <li class="reveal"><span>Mois 1</span><h3>Les tâches qui squattaient partent enfin.</h3><p>Ce que tu repoussais depuis des semaines passe enfin au vert. Tu tiens ta feuille sans même y penser.</p></li>
      <li class="reveal"><span>Année 1</span><h3>Tu as la preuve que tu as changé.</h3><p>Ton année tient sur un écran&nbsp;: tes EPIC WIN, tes creux, ta discipline qui s’est installée.</p></li>
    </ol>
  </div>
</section>

<section class="how" id="comment">
  <div class="wrap">
    <p class="eyebrow">Comment ça marche</p>
    <h2>Trois gestes par jour. C’est tout.</h2>
    <div class="steps">
      <article class="reveal"><b>Le matin</b><h3>Tu poses.</h3><p>Tu écris dans la ligne du jour ce que tu vas faire. Ce que tu as reporté hier est déjà là.</p></article>
      <article class="reveal"><b>La journée</b><h3>Tu fais.</h3><p>Un geste pour marquer une tâche faite. La feuille reste devant toi, nette, sans distraction.</p></article>
      <article class="reveal"><b>Le soir</b><h3>Tu assumes.</h3><p>Chaque tâche reçoit sa couleur. Honnêtement. L’app te chambre un peu. C’est ce moment qui change tout.</p></article>
    </div>
    <div class="palette reveal" role="list" aria-label="Les couleurs du verdict">
      ${colors.map(([c, n, d]) => `<div role="listitem" class="swatch"><i class="d-${c}"></i><b>${n}</b><span>${d}</span></div>`).join('')}
    </div>
  </div>
</section>

<section class="roast">
  <div class="wrap split">
    <div class="reveal">
      <p class="eyebrow">Le mode roast</p>
      <h2>Une app qui te chambre. Gentiment.</h2>
      <p class="lead">Tiger Task réagit à tes couleurs. Trop de flemme&nbsp;? Elle te le fait remarquer. Une journée parfaite&nbsp;? Elle s’inquiète pour toi. Rien de méchant&nbsp;: juste assez pour que tu souries, et que tu reviennes demain.</p>
      <p class="fine">Tu préfères le silence&nbsp;? Ça se coupe en un geste.</p>
    </div>
    <div class="bubbles reveal" aria-label="Exemples de réactions du tigre">
      <div class="bubbles-who">${tigerHead(56)}<span>Le tigre, ton coach pas très diplomate</span></div>
      <p class="bubble"><i class="d-y"></i>Trois reports. Elle a emménagé chez toi.</p>
      <p class="bubble"><i class="d-k"></i>EPIC FAIL débloqué. Il fallait oser.</p>
      <p class="bubble"><i class="d-b"></i>EPIC WIN. Projet bouclé. Champagne (avec modération).</p>
      <p class="bubble"><i class="d-g"></i>Enfin&nbsp;! Elle commençait à payer un loyer.</p>
      <p class="bubble"><i class="d-g"></i>Tout est vert. Qui es-tu, et qu’as-tu fait de toi&nbsp;?</p>
      <p class="bubble"><i class="d-r"></i>Abandonnée. Parfois, lâcher, c’est grandir.</p>
    </div>
  </div>
</section>

<section class="night">
  <div class="night-sky" aria-hidden="true"></div>
  <div class="wrap split">
    <div class="reveal">
      <p class="eyebrow">Le soir venu</p>
      <h2>Le verdict du soir, sans culpabilité.</h2>
      <p class="lead">Quand la journée se termine, l’app passe en mode nuit. Une lumière douce, le temps de regarder ta journée en face. Pas pour te juger&nbsp;: la flemme, ça se soigne mieux en riant.</p>
      <a class="btn btn-light" href="/methode/">Découvrir la méthode</a>
    </div>
    <div class="reveal">${dayCard({ night: true })}</div>
  </div>
</section>

<section class="origin">
  <div class="wrap narrow reveal">
    <p class="eyebrow">Née d’un tableur</p>
    <h2>Une méthode éprouvée pendant des années, enfin dans ta poche.</h2>
    <p>Tout part d’un simple fichier Excel, tenu chaque jour pendant des années par l’auteur Fibre Tigre, qui l’a raconté dans ses billets. Une ligne par jour, des cases colorées, aucune excuse. Tiger Task garde cet esprit, et lui donne une forme moderne&nbsp;: rapide, belle, et toujours avec toi.</p>
    <p class="fine">Tiger Task est un projet indépendant, sans lien avec Fibre Tigre.</p>
  </div>
</section>

<section class="pricing" id="tarifs">
  <div class="wrap">
    <p class="eyebrow">Tarifs</p>
    <h2>Commence gratuitement. Garde ton année quand tu es prêt.</h2>
    ${pricingCards()}
  </div>
</section>

<section class="final">
  <div class="wrap narrow reveal">
    <div class="final-tiger">${tigerHead(72)}<p class="tiger-bubble is-static">Bon. On s’y met, ou je retourne dormir&nbsp;?</p></div>
    <h2>Demain matin, une seule ligne.</h2>
    <p class="lead">C’est tout ce qu’il faut pour commencer. Le reste viendra, jour après jour. Et l’app sera là pour te chambrer.</p>
    <a class="btn btn-primary btn-lg" href="/app/">Poser ma première journée</a>
  </div>
</section>`,
};

export const methode = {
  path: '/methode/',
  title: 'La méthode',
  description: 'Une ligne par jour, sept couleurs pour juger chaque tâche, les reports qui reviennent le lendemain : la méthode de la feuille du jour expliquée simplement.',
  body: `
<section class="page-head"><div class="wrap narrow">
  <p class="eyebrow">La méthode</p>
  <h1>Une ligne par jour. Une couleur par tâche. Aucune excuse.</h1>
  <p class="lead">La plupart des to-do lists t’aident à accumuler. Celle-ci t’aide à voir. Voici comment elle fonctionne, et pourquoi elle marche.</p>
</div></section>
<section class="prose wrap narrow">
  <h2>1. Une ligne par jour</h2>
  <p>Chaque jour a sa ligne, et seulement sa ligne. Pas de projets, pas de colonnes, pas d’étiquettes. Le matin, tu y écris ce que tu vas faire aujourd’hui. Ce qui n’a pas sa place aujourd’hui n’y va pas.</p>
  <h2>2. Le soir, le verdict</h2>
  <p>Avant de fermer ta journée, chaque tâche reçoit une couleur. C’est le cœur de la méthode&nbsp;: un moment honnête, court, et un peu drôle, où tu regardes ce que tu as vraiment fait.</p>
  <div class="palette" role="list" aria-label="Les couleurs du verdict">
    ${colors.map(([c, n, d]) => `<div role="listitem" class="swatch"><i class="d-${c}"></i><b>${n}</b><span>${d}</span></div>`).join('')}
  </div>
  <h2>3. Ta flemme te suit</h2>
  <p>Une tâche en flemme (jaune) ou en imprévu (violet) se recopie toute seule le lendemain, avec un compteur. Elle ne disparaît pas dans une liste infinie&nbsp;: elle te suit, et l’app commence à te chambrer au troisième report. Le jour où tu la termines enfin, ouf.</p>
  <p>Abandonner n’est pas reporter&nbsp;: en rouge, la tâche part pour de bon, sans regret. Le noir est réservé aux EPIC FAIL, ces échecs si spectaculaires qu’on finit par en rire. Et son contraire, le bleu, aux EPIC WIN&nbsp;: la dernière tâche d’un projet, la fin d’un long combat.</p>
  <h2>4. L’année comme un tableau</h2>
  <p>Jour après jour, tes couleurs dessinent ton année. Tu vois tes semaines pleines, tes creux, tes habitudes qui s’installent. Ce n’est pas un score&nbsp;: c’est un miroir.</p>
  <h2>Pourquoi ça marche</h2>
  <p>Parce que la méthode ne te demande pas d’être organisé&nbsp;: elle te demande d’être honnête. Une fois que tu vois ce que tu repousses, tu ne peux plus faire semblant. Et c’est précisément ce qui te fait avancer.</p>
  <h2>D’où elle vient</h2>
  <p>Cette façon de s’organiser a été tenue et racontée pendant des années par l’auteur Fibre Tigre, dans un simple fichier Excel. Tiger Task en reprend l’esprit dans une app moderne. C’est un projet indépendant, sans lien avec lui.</p>
  <p class="cta-row"><a class="btn btn-primary btn-lg" href="/app/">Essayer la méthode</a></p>
</section>`,
};

export const tarifs = {
  path: '/tarifs/',
  title: 'Tarifs',
  description: 'Tiger Task est gratuit pour adopter la méthode. Pro garde toute ton année : 29,90 € par an, 3,99 € par mois, ou 59,90 € à vie pour les 500 premiers.',
  body: `
<section class="page-head"><div class="wrap narrow">
  <p class="eyebrow">Tarifs</p>
  <h1>Le prix d’un café par mois pour reprendre la main sur tes journées.</h1>
  <p class="lead">Commence gratuitement, sans carte bancaire. Passe à Pro le jour où tu ne veux plus perdre une seule de tes journées.</p>
</div></section>
<section class="pricing"><div class="wrap">${pricingCards()}</div></section>
<section class="prose wrap narrow">
  <h2>Gratuit ou Pro&nbsp;?</h2>
  <p>En gratuit, tu as toute la méthode, sur tous tes appareils&nbsp;: la feuille, les couleurs, les reports, les rituels. Tes 30 derniers jours restent nets&nbsp;; les plus anciens sont bien sauvegardés, mais s’effacent dans le flou. Avec Pro, ton année entière reste lisible et ton bilan s’affiche.</p>
  <h2>Un ami t’a recommandé Tiger Task&nbsp;?</h2>
  <p>Ton premier mois est offert sur les offres mensuelle et annuelle, et l’offre à vie est à −10&nbsp;%.</p>
  <h2>Questions sur le paiement</h2>
  <h3>Puis-je résilier à tout moment&nbsp;?</h3>
  <p>Oui, en deux clics depuis ton compte. Tu gardes Pro jusqu’à la fin de la période payée.</p>
  <h3>Que se passe-t-il si j’arrête Pro&nbsp;?</h3>
  <p>Rien n’est supprimé. Tes jours anciens redeviennent flous, et reviennent nets dès que tu repasses à Pro.</p>
  <h3>Comment fonctionne l’offre Fondateurs&nbsp;?</h3>
  <p>Les 500 premières offres à vie sont à 59,90&nbsp;€. Ensuite, l’offre à vie passe à 79,90&nbsp;€.</p>
  <h3>Le paiement est-il sécurisé&nbsp;?</h3>
  <p>Le paiement passe par Stripe. Tiger Task ne voit ni ne stocke jamais ta carte bancaire.</p>
</section>`,
};

const faqs = [
  ['Tiger Task est-il gratuit&nbsp;?', 'Oui. Toute la méthode est gratuite, sans limite de durée et sans carte bancaire, et ta feuille se synchronise sur tous tes appareils dès que tu crées un compte. Pro rend ton année entière lisible et ajoute ton bilan.'],
  ['Est-ce que ça marche sur iPhone et Android&nbsp;?', 'Oui. Ouvre l’app dans ton navigateur, puis « Ajouter à l’écran d’accueil » : elle s’installe comme une vraie app, et fonctionne même hors ligne. Des widgets d’écran d’accueil arrivent bientôt.'],
  ['Où sont stockées mes tâches&nbsp;?', 'Sur ton appareil, pour que l’app soit instantanée et marche hors ligne. Avec un compte (gratuit), elles sont aussi sauvegardées sur nos serveurs et synchronisées sur tes autres appareils. Personne d’autre ne les lit.'],
  ['Je n’ai jamais tenu une to-do list plus d’une semaine. Pourquoi celle-ci&nbsp;?', 'Parce qu’elle ne te demande presque rien : une ligne le matin, une couleur le soir. Et parce qu’elle te montre ce que tu repousses, ce qui donne une vraie raison d’y revenir.'],
  ['C’est quoi les sept couleurs&nbsp;?', 'Faite, EPIC WIN, flemme, imprévu, abandonnée, EPIC FAIL, et à faire. Le détail est sur la page <a href="/methode/">La méthode</a>.'],
  ['L’app va vraiment me roaster&nbsp;?', 'Oui, gentiment. Quand tu colores une tâche en jaune pour la troisième fois, elle te le fait remarquer. Rien de méchant, et ça se coupe en un geste dans ton compte.'],
  ['Puis-je exporter mes données&nbsp;?', 'Oui, à tout moment et gratuitement, depuis ton compte. Tes données t’appartiennent.'],
  ['Comment résilier Pro&nbsp;?', 'Depuis ton compte, en deux clics. Tu gardes Pro jusqu’à la fin de la période payée.'],
  ['Comment fonctionne l’affiliation&nbsp;?', 'Tu partages ton lien : tes amis ont leur premier mois offert, et tu gagnes 7 € par abonnement annuel et 15 € par offre à vie. Tout est sur la page <a href="/affiliation/">Programme d’affiliation</a>.'],
  ['Tiger Task est-il lié à Fibre Tigre&nbsp;?', 'Non. Tiger Task s’inspire de la méthode qu’il a décrite publiquement, mais c’est un projet indépendant.'],
];

export const faq = {
  path: '/faq/',
  title: 'Questions fréquentes',
  description: 'Tout ce qu’il faut savoir sur Tiger Task : gratuit ou Pro, iPhone et Android, données, export, résiliation, affiliation.',
  body: `
<section class="page-head"><div class="wrap narrow">
  <p class="eyebrow">FAQ</p>
  <h1>Les questions qu’on nous pose.</h1>
</div></section>
<section class="wrap narrow faq">
  ${faqs.map(([q, a]) => `<details class="reveal"><summary>${q}</summary><p>${a}</p></details>`).join('\n  ')}
  <p class="fine">Une autre question&nbsp;? Écris-nous à <a href="mailto:[EMAIL DE CONTACT]">[EMAIL DE CONTACT]</a>.</p>
</section>
<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(([q, a]) => ({
      '@type': 'Question',
      name: q.replace(/&nbsp;/g, ' '),
      acceptedAnswer: { '@type': 'Answer', text: a.replace(/<[^>]+>/g, '') },
    })),
  })}</script>`,
};

export const affiliation = {
  path: '/affiliation/',
  title: 'Programme d’affiliation',
  description: 'Recommande Tiger Task : tes amis ont leur premier mois offert, et tu gagnes 7 € par abonnement annuel et 15 € par offre à vie.',
  body: `
<section class="page-head"><div class="wrap narrow">
  <p class="eyebrow">Programme d’affiliation</p>
  <h1>Aide quelqu’un à reprendre la main sur ses journées. Et sois payé pour ça.</h1>
  <p class="lead">Tu parles de Tiger Task autour de toi, sur ton blog, ta chaîne ou ta newsletter. Tes amis ont leur premier mois offert. Toi, tu gagnes à chaque abonnement.</p>
  <p class="cta-row"><a class="btn btn-primary btn-lg" href="/app/">Créer mon lien</a></p>
</div></section>
<section class="wrap">
  <div class="steps">
    <article class="reveal"><b>1</b><h3>Crée ton lien</h3><p>Dans l’app, onglet Compte, « Devenir affilié ». Ton lien est prêt en un clic.</p></article>
    <article class="reveal"><b>2</b><h3>Partage-le</h3><p>Chaque personne qui arrive par ton lien a son premier mois offert, ou −10&nbsp;% sur l’offre à vie.</p></article>
    <article class="reveal"><b>3</b><h3>Sois payé</h3><p><strong>7&nbsp;€</strong> par abonnement annuel et <strong>15&nbsp;€</strong> par offre à vie, versés par virement.</p></article>
  </div>
</section>
<section class="prose wrap narrow">
  <h2>Les règles, simplement</h2>
  <ul>
    <li>Tu gagnes 7&nbsp;€ pour la première année de chaque abonnement annuel, et 15&nbsp;€ pour chaque offre à vie.</li>
    <li>Les abonnements mensuels ne donnent pas de commission. Si la personne passe à l’annuel dans les 60 jours, tu touches tes 7&nbsp;€.</li>
    <li>Ton lien reste valable 60 jours après le clic.</li>
    <li>Une commission devient disponible 30 jours après le paiement, le temps du délai de remboursement.</li>
    <li>Le virement se fait dès 20&nbsp;€ disponibles, chaque mois.</li>
    <li>Pas d’auto-parrainage, pas de publicité payante sur le nom « Tiger Task », pas de spam. Sinon, le compte affilié est suspendu.</li>
  </ul>
  <p class="fine">Les commissions sont des revenus : selon ta situation, tu dois peut-être les déclarer.</p>
</section>`,
};

const legal = (path, title, description, sections) => ({
  path,
  title,
  description,
  body: `
<section class="page-head"><div class="wrap narrow"><h1>${title}</h1><p class="fine">Dernière mise à jour : [DATE]. Les passages entre crochets sont à compléter, et le texte est à faire relire par un professionnel du droit.</p></div></section>
<section class="prose wrap narrow">${sections}</section>`,
});

export const mentions = legal(
  '/mentions-legales/',
  'Mentions légales',
  'Mentions légales du site Tiger Task.',
  `<h2>Éditeur</h2><p>[NOM OU RAISON SOCIALE], [STATUT, ex. entrepreneur individuel], [ADRESSE], SIREN [NUMÉRO], email : [EMAIL DE CONTACT]. Directeur de la publication : [NOM].</p>
<h2>Hébergement</h2><p>Site et application : Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, États-Unis. Données des comptes : Supabase, [RÉGION DU PROJET]. Paiements : Stripe Payments Europe Ltd., Dublin, Irlande.</p>
<h2>Propriété intellectuelle</h2><p>Les textes, visuels et le code de Tiger Task sont la propriété de l’éditeur, sauf mention contraire. La méthode dont Tiger Task s’inspire a été décrite publiquement par l’auteur Fibre Tigre&nbsp;; Tiger Task est un projet indépendant, sans lien avec lui.</p>`,
);

export const cgv = legal(
  '/cgv/',
  'Conditions générales de vente',
  'Conditions générales de vente de Tiger Task Pro.',
  `<h2>Offres</h2><p>Tiger Task est gratuit. Tiger Task Pro est proposé en abonnement mensuel (3,99&nbsp;€ TTC), annuel (29,90&nbsp;€ TTC) ou en accès à vie (79,90&nbsp;€ TTC, 59,90&nbsp;€ TTC pour les 500 premiers). Des offres promotionnelles ponctuelles peuvent s’appliquer.</p>
<h2>Paiement</h2><p>Le paiement est traité par Stripe. Les abonnements sont reconduits automatiquement à chaque échéance, jusqu’à résiliation.</p>
<h2>Résiliation</h2><p>L’abonnement est résiliable à tout moment depuis le compte. Il reste actif jusqu’à la fin de la période payée.</p>
<h2>Droit de rétractation</h2><p>[À FAIRE VALIDER : conditions de rétractation pour un contenu numérique fourni immédiatement, et accord exprès du client recueilli au paiement.]</p>
<h2>Essai offert</h2><p>Un mois d’essai est offert aux personnes recommandées par un affilié sur les offres mensuelle et annuelle. Sans résiliation avant la fin de l’essai, l’abonnement choisi commence.</p>
<h2>Contact</h2><p>[EMAIL DE CONTACT]</p>`,
);

export const confidentialite = legal(
  '/confidentialite/',
  'Politique de confidentialité',
  'Comment Tiger Task traite tes données.',
  `<h2>Ce que nous collectons</h2><p>Sans compte, tes tâches restent sur ton appareil. Avec un compte, nous conservons ton email et tes tâches, pour les sauvegarder et les synchroniser entre tes appareils. Pour améliorer l’app, nous mesurons des événements d’usage anonymes (ouverture de l’app, journée colorée, affichage de l’offre), avec un identifiant aléatoire, jamais le contenu de tes tâches.</p>
<h2>Pourquoi</h2><p>Pour faire fonctionner ton compte, sauvegarder et synchroniser tes tâches, traiter les paiements, calculer les commissions d’affiliation et comprendre l’usage de l’app.</p>
<h2>Avec qui</h2><p>Supabase (comptes et données), Stripe (paiements), Cloudflare (hébergement). Aucune revente, aucune publicité.</p>
<h2>Tes droits</h2><p>Accès, rectification, suppression, portabilité&nbsp;: écris à [EMAIL DE CONTACT]. L’export de tes tâches est disponible à tout moment dans l’app. Tu peux aussi saisir la CNIL.</p>
<h2>Cookies</h2><p>Un seul cookie technique, posé quand tu arrives par un lien d’affilié (60 jours), pour attribuer la recommandation. Aucun cookie publicitaire.</p>`,
);

export const notFound = {
  path: '/404',
  title: 'Page introuvable',
  description: 'Cette page n’existe pas.',
  body: `<section class="page-head"><div class="wrap narrow"><p class="eyebrow">404</p><h1>Cette page s’est perdue dans le flou.</h1><p class="lead">Elle n’existe pas, ou plus.</p><p class="cta-row"><a class="btn btn-primary" href="/">Revenir à l’accueil</a><a class="btn btn-ghost" href="/app/">Ouvrir l’app</a></p></div></section>`,
};
