# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Une personne qui s'organise seule, au quotidien, avec la méthode de Fibre Tigre : une ligne par jour, ses tâches dans la ligne, et chaque tâche colorée selon ce qu'il en est advenu. Usage sur téléphone (PWA) et ordinateur, plusieurs fois par jour : le matin pour poser la journée, le soir pour rendre le verdict.

## Product Purpose
Moderniser le tableau Excel de Fibre Tigre sans en perdre la mécanique : l'année se lit comme une feuille, la ligne du jour est mise en avant, les couleurs racontent la discipline. Réussite : l'utilisateur tient sa feuille tous les jours et peut relire n'importe quelle journée d'un coup d'œil.

## Positioning
Pas une todo-list en colonne : une feuille-calendrier où chaque jour est une ligne et chaque tâche une cellule colorée (7 couleurs de verdict). Les reports (jaune, violet) recopient la tâche au lendemain.

## Operating Context
Méthode d'origine : un simple tableau Excel (une ligne par jour, cellules colorées). Références explicites de l'utilisateur : blanc, gris, lignes noires/grises, vert ; très moderne, minimaliste, glassmorphism.

## Capabilities and Constraints
- Une ligne par jour, toute l'année ; la ligne du jour est mise en avant.
- Les tâches sont toujours disposées horizontalement dans la ligne (jamais en liste verticale), y compris sur mobile.
- Une seule ligne « ouverte » à la fois (aujourd'hui par défaut) : ses cellules passent à la ligne ; les lignes fermées tiennent sur une hauteur, avec une cellule « +N » colorée pour le débordement.
- 7 couleurs : à faire, faite, reportée (flemme), pas faite, enfin faite, reportée (imprévu), échec.
- Rituels (tâches récurrentes), bilan annuel, compte Supabase, abonnement Stripe.
- Local-first, hors ligne ; hébergement Cloudflare (Worker avec assets statiques) ; Supabase.

## Brand Commitments
Nom : Tiger Task. Inspiré de Fibre Tigre (crédit dans l'app).

## Product Principles
1. La feuille est l'app : tout part de la ligne du jour.
2. Lire une journée en un regard horizontal.
3. Rien de caché : tout débordement reste visible par ses couleurs.
4. Minimalisme : chaque élément doit gagner sa place.
