---
name: branding
description: Create a complete brand identity from scratch (A to Z). Use when the user wants to design or build a brand: brand name, positioning, color palette, typography, logo concept, brand voice, and implementation as design tokens/CSS variables in the codebase.
---

# Branding Skill — De A à Z

Guide complet pour concevoir et implémenter une identité de marque depuis zéro.

## Workflow

Crée une liste de tâches pour toutes les étapes et travaille dessus une par une.

---

### 1. Découverte — Comprendre le projet

Commence par poser les bonnes questions (ou analyser le codebase/README si les réponses sont déjà disponibles) :

- **Secteur / industrie** : Quel est le domaine d'activité ?
- **Public cible** : Qui sont les utilisateurs ? (âge, profession, besoins)
- **Valeurs clés** : Quels 3-5 mots résument l'essence de la marque ?
- **Ton souhaité** : Sérieux ? Ludique ? Luxe ? Accessible ?
- **Concurrents** : Quels acteurs existent déjà dans cet espace ?
- **Objectif** : Pourquoi cette marque doit-elle exister ?

Si les informations sont dans le codebase, lis les fichiers README, `index.html`, ou tout fichier de configuration pour extraire le contexte existant.

---

### 2. Stratégie de marque

Sur la base de la découverte, définis :

#### Positionnement
Rédige une phrase de positionnement :
> "Pour [public cible], [nom de marque] est la [catégorie] qui [bénéfice unique] parce que [preuve/raison de croire]."

#### Mission & Vision
- **Mission** (pourquoi on existe aujourd'hui) : 1 phrase courte et percutante
- **Vision** (où on veut aller) : 1 phrase inspirante

#### Valeurs de marque
Liste 3 à 5 valeurs fondamentales avec une description courte de chacune.

#### Archétype de marque
Identifie l'archétype dominant parmi :
- Le Créateur, L'Explorer, Le Héros, Le Sage, L'Innocent, Le Rebelle, Le Magicien, L'Amoureux, Le Bouffon, L'Orphelin, Le Souverain, Le Serviteur

---

### 3. Identité verbale

#### Nom de marque
Si le nom n'est pas fixé, propose 5 options avec justification pour chacune :
- **Descriptif** : dit ce que c'est
- **Évocateur** : crée une image/émotion
- **Inventé** : mot nouveau, mémorable
- **Acronyme** : initiales significatives
- **Nom propre** : fondateur ou personnage

Critères de validation d'un bon nom :
- Court (1-2 syllabes idéalement)
- Prononçable et mémorisable
- Disponible (domain, trademark)
- Fonctionne à l'international si nécessaire

#### Tagline
Propose 3 taglines candidates (6 mots max chacune).

#### Ton & Voix (Brand Voice)
Définis 3 attributs de voix avec exemple de formulation :

| Attribut | On dit... | On ne dit pas... |
|----------|-----------|-----------------|
| [attribut 1] | exemple | contre-exemple |
| [attribut 2] | exemple | contre-exemple |
| [attribut 3] | exemple | contre-exemple |

---

### 4. Identité visuelle

#### Palette de couleurs

Définis une palette cohérente avec justification psychologique :

```
Couleur Primaire    : #XXXXXX — [rôle : action, CTA, logo]
Couleur Secondaire  : #XXXXXX — [rôle : accents, highlights]
Couleur Neutre Clair: #XXXXXX — [rôle : backgrounds, surfaces]
Couleur Neutre Sombre:#XXXXXX — [rôle : textes, contrastes]
Couleur d'Accent    : #XXXXXX — [rôle : alertes, succès, erreurs]
```

Vérifie les ratios de contraste WCAG :
- Texte normal : minimum 4.5:1
- Grands textes : minimum 3:1
- Éléments UI : minimum 3:1

#### Typographie

Sélectionne 2 familles de polices (disponibles sur Google Fonts ou système) :

```
Titre (Display)  : [Police] — [caractère : géométrique, humaniste, slab...]
Corps (Body)     : [Police] — [caractère : lisible, neutre, chaleureux...]
Mono (Code)      : [Police] — [si applicable pour produits tech]
```

Définis la hiérarchie typographique :
- H1 : [taille]px / [font-weight] / [line-height]
- H2 : ...
- H3 : ...
- Body : ...
- Caption : ...

#### Concept de logo

Décris le concept de logo en texte (puisque Claude ne génère pas d'images) :

- **Type** : Wordmark / Lettermark / Symbol + Wordmark / Abstract mark / Mascot
- **Forme principale** : description géométrique ou symbolique
- **Signification** : pourquoi cette forme représente la marque
- **Variantes** : version couleur, monochrome, inversé, favicon (16x16)
- **Espace de protection** : recommandation de marge minimale

Si le projet est une app web, implémente le logo en SVG inline dans le codebase.

#### Iconographie & Style visuel

- **Style d'icônes** : Outlined / Filled / Duo-tone / Custom
- **Librairie recommandée** : Lucide, Phosphor, Heroicons, Tabler...
- **Style d'illustrations** : Flat, 3D, Line art, Isométrique...
- **Style photographique** : directives sur les images à utiliser

---

### 5. Implémentation dans le codebase

Si un projet existe, implémente l'identité visuelle comme design tokens.

#### Design Tokens CSS

Crée ou mets à jour un fichier de tokens (`:root` CSS ou fichier séparé `tokens.css`) :

```css
:root {
  /* ── Couleurs ── */
  --color-primary:        #XXXXXX;
  --color-primary-light:  #XXXXXX;
  --color-primary-dark:   #XXXXXX;
  --color-secondary:      #XXXXXX;
  --color-accent:         #XXXXXX;
  --color-surface:        #XXXXXX;
  --color-surface-raised: #XXXXXX;
  --color-background:     #XXXXXX;
  --color-text:           #XXXXXX;
  --color-text-muted:     #XXXXXX;
  --color-border:         #XXXXXX;
  --color-success:        #XXXXXX;
  --color-warning:        #XXXXXX;
  --color-error:          #XXXXXX;

  /* ── Typographie ── */
  --font-display:  'NomPolice', sans-serif;
  --font-body:     'NomPolice', sans-serif;
  --font-mono:     'NomPolice', monospace;

  --text-xs:   0.75rem;
  --text-sm:   0.875rem;
  --text-base: 1rem;
  --text-lg:   1.125rem;
  --text-xl:   1.25rem;
  --text-2xl:  1.5rem;
  --text-3xl:  1.875rem;
  --text-4xl:  2.25rem;

  --font-normal:   400;
  --font-medium:   500;
  --font-semibold: 600;
  --font-bold:     700;

  --leading-tight:  1.25;
  --leading-normal: 1.5;
  --leading-loose:  1.75;

  /* ── Espacements ── */
  --space-1:  0.25rem;
  --space-2:  0.5rem;
  --space-3:  0.75rem;
  --space-4:  1rem;
  --space-6:  1.5rem;
  --space-8:  2rem;
  --space-12: 3rem;
  --space-16: 4rem;

  /* ── Bordures & Rayons ── */
  --radius-sm:   4px;
  --radius-md:   8px;
  --radius-lg:   12px;
  --radius-xl:   16px;
  --radius-full: 9999px;

  --border-thin:   1px;
  --border-normal: 2px;

  /* ── Ombres ── */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.06);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.08), 0 4px 6px rgba(0,0,0,0.05);

  /* ── Transitions ── */
  --transition-fast:   150ms ease;
  --transition-normal: 250ms ease;
  --transition-slow:   400ms ease;

  /* ── Z-index ── */
  --z-base:    0;
  --z-raised:  10;
  --z-overlay: 100;
  --z-modal:   1000;
  --z-toast:   9999;
}
```

#### Application dans le CSS existant

Remplace les valeurs hardcodées dans le CSS existant par les tokens. Parcours le fichier CSS principal et substitue :
- Les couleurs hex → `var(--color-*)`
- Les tailles de police → `var(--text-*)`
- Les marges/paddings → `var(--space-*)`
- Les border-radius → `var(--radius-*)`

---

### 6. Brand Guidelines — Document de référence

Crée un fichier `BRAND.md` à la racine du projet avec :

```markdown
# [Nom de marque] — Brand Guidelines

## Identité
- Mission
- Vision
- Valeurs
- Archétype

## Identité verbale
- Nom & Tagline
- Ton & Voix
- Exemples de formulations

## Identité visuelle
- Logo (description + variantes)
- Palette de couleurs (avec codes hex)
- Typographie (polices + hiérarchie)
- Iconographie

## Usage
- Ce qu'il faut faire ✅
- Ce qu'il ne faut pas faire ❌
- Exemples d'application
```

---

### 7. Validation & Cohérence

Avant de terminer, vérifie :

- [ ] La palette respecte les standards d'accessibilité WCAG AA
- [ ] Les polices sont bien chargées (Google Fonts import ou local)
- [ ] Les tokens CSS sont utilisés de manière cohérente dans tout le code
- [ ] Le ton de la marque est cohérent avec le contenu textuel existant
- [ ] Le `BRAND.md` est complet et lisible

---

### 8. Commit et push

Crée un commit avec un message clair :

```
feat: add brand identity — [Nom de marque]

- Design tokens CSS (colors, typography, spacing)
- Brand guidelines in BRAND.md
- Applied visual identity to existing styles
```

Push vers la branche de développement.

---

## Livrable final

En dernier message, fournis un résumé structuré :

### Identité de marque — [Nom]

**Positionnement** : [1 phrase]
**Tagline** : "[tagline]"
**Archétype** : [archétype]

**Palette** :
- Primaire : `#XXXXXX`
- Secondaire : `#XXXXXX`
- Neutre : `#XXXXXX`

**Typographie** :
- Titres : [Police]
- Corps : [Police]

**Fichiers créés/modifiés** :
- `BRAND.md` — brand guidelines complet
- `css/tokens.css` (ou fichier concerné) — design tokens

**Ce que tu peux faire maintenant** :
- Ouvrir `BRAND.md` pour avoir la référence complète
- Utiliser les variables CSS `--color-primary`, etc. dans tout nouveau composant
- Demander à Claude d'appliquer ces tokens à un nouveau composant spécifique
