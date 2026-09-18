# SR Bien-être — Site vitrine

Site vitrine statique pour **SR Bien-être**, sophrologue & énergéticienne à Saint-Raphaël (83700).

Prestations : sophrologie, soins énergétiques (Reiki), drainage lymphatique, massage modelant minceur, yoga enfants.

## Stack

Site statique — HTML / CSS / JS, sans build. Se déploie tel quel (Vercel, Netlify, GitHub Pages…).

## Structure

```
index.html      Page unique (hero, prestations, à propos, cabinet, réservation, contact)
styles.css      Styles
script.js       Menu mobile + année du footer
assets/
  favicon.svg
  img/          Portrait + photos du cabinet
```

## Prévisualiser en local

```bash
python3 -m http.server 8000
```

Puis ouvrir http://localhost:8000

## À compléter

- **Lien Planity** : remplacer `https://www.planity.com/` par l'URL exacte du cabinet
  (recherche « SR Bien-être », dans `index.html` + le JSON-LD).
- **Domaine** : mettre à jour l'URL canonique (`<link rel="canonical">`, OG et schema.org)
  une fois le nom de domaine choisi.
