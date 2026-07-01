# Identité visuelle — Portfolio Idris Naulleau-Aurial

Document de référence du système de design. Objectif : une seule échelle typographique cohérente, finie l'anarchie des tailles.

## 1. Polices

| Rôle | Famille | Token CSS | Usage |
|---|---|---|---|
| Texte & titres | **Inter** | `--font-sans` | Corps, titres, UI. La police par défaut de tout le site. |
| Labels techniques | **JetBrains Mono** | `--font-mono` | UNIQUEMENT les sur-titres / étiquettes en majuscules : kicker, pill, badges, code. Jamais pour du texte courant. |
| Affiche (Hollywood) | **Bebas Neue** | `--font-display` | Grands titres "affiche de film", thème Hollywood seulement. En thème Classic, `--font-display` = Inter. |

Règle d'or : **un bloc de texte = une seule police**. Le mono sert d'accent ponctuel (étiquettes), pas de texte.

## 2. Échelle typographique (la seule autorisée)

Fini les `10.5px`, `11.5px`, `12.5px`, `13.5px`, `14.5px`… On se limite à cette échelle, exposée en tokens CSS (`:root` dans `variables.css`) :

| Token | Taille | Usage |
|---|---|---|
| `--fs-overline` | 11px | Sur-titres mono MAJUSCULES : kicker, pill, breadcrumb, eyebrow |
| `--fs-caption` | 12px | Légendes, mentions fines, méta |
| `--fs-sm` | 13px | UI secondaire : sommaire, petites listes, notes |
| `--fs-ui` | 14px | UI par défaut : boutons, navigation, liens d'action |
| `--fs-base` | 16px | Corps de texte |
| `--fs-lg` | 18px | Chapeau / paragraphe d'intro |
| `--fs-xl` | 21px | Sous-titres (h3) |
| `--fs-2xl` | 26px | Titres de section secondaires |
| `--fs-h2` | `clamp(22px, 2.4vw, 28px)` | Titres de section (h2) |
| `--fs-h1` | `clamp(30px, 4.5vw, 44px)` | Titre de page (h1) |
| `--fs-display` | `clamp(44px, 7vw, 92px)` | Hero d'accueil |

### Hauteurs de ligne
| Token | Valeur | Usage |
|---|---|---|
| `--lh-tight` | 1.12 | Gros titres |
| `--lh-snug` | 1.4 | Sous-titres, UI |
| `--lh-normal` | 1.6 | Corps de texte |

### Graisses (Inter)
400 (corps) · 500 (UI/labels) · 600 (semibold, sous-titres) · 700 (titres) · 800/900 (hero).

## 3. Table de correspondance (consolidation)

Pour ramener les ~60 tailles existantes sur l'échelle :

| Anciennes valeurs | Devient |
|---|---|
| 8.5 / 9 / 9.5 / 10 / 10.5 / 11 / 11.5 px | `--fs-overline` (11) ou `--fs-caption` (12) selon le rôle |
| 12 / 12.5 px | `--fs-caption` (12) |
| 13 / 13.5 px | `--fs-sm` (13) |
| 14 / 14.5 px | `--fs-ui` (14) |
| 15 / 16 px | `--fs-base` (16) |
| 18 px | `--fs-lg` (18) |
| 20 / 21 / 22 px | `--fs-xl` (21) |
| 26 / 28 px | `--fs-2xl` (26) ou `--fs-h2` |
| tous les `clamp()` de titres h2 | `--fs-h2` |
| tous les `clamp()` de titres h1 | `--fs-h1` |
| `clamp()` hero géants | `--fs-display` |

## 4. Couleurs (déjà tokenisées, rappel)

`--bg #0A0B0F` · `--surface #11131A` · `--text #F2F4F7` · `--text-soft` · `--muted #6B7280` · hairlines.
Accent : `--accent` = `#22D3A0` (Classic mint) / `#E63946` (Hollywood cinabre). Toujours via la variable, jamais en dur.

## 5. Divers
Largeur max `--max-width: 1280px`, prose `--prose: 860px`, rayon `--radius: 10px`, pill `--radius-pill: 999px`.
