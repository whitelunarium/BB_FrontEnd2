# PNEC Image Placeholders

This directory currently contains placeholder assets. Replace each with a real PNEC photo before launching at powaynec.com.

## Images Needed

### Homepage Hero
| Filename | Size | Description |
|---|---|---|
| `hero-neighborhood.jpg` | 600×400 | Aerial or street-level photo of a Poway residential neighborhood — ideally showing hills and homes that illustrate wildfire interface risk |
| `hero-firefighters.jpg` | 600×400 | Cal Fire or Poway Fire Department vehicles or crew during a training exercise in Poway |
| `hero-go-bag.jpg` | 600×400 | Close-up of a well-organized go-bag / emergency kit laid out on a table |

### About Section
| Filename | Size | Description |
|---|---|---|
| `about-volunteers.jpg` | 500×400 | Group photo of PNEC volunteers at a training event or coordinator meeting |

### Gallery Placeholder
| Filename | Size | Description |
|---|---|---|
| `gallery-placeholder.jpg` | 400×300 | Generic neutral placeholder shown before gallery images load from the API |

### Favicon / Brand
| Filename | Size | Description |
|---|---|---|
| `favicon.ico` | 32×32 | PNEC logo icon (navy square with "PNEC" text or emergency symbol) |
| `pnec-logo.png` | 200×60 | Full PNEC logo for use in email headers and print materials |

## How to Use in Pages

Reference images with Jekyll's `relative_url` filter:

```html
<img src="{{ '/assets/images/hero-neighborhood.jpg' | relative_url }}"
     alt="Poway neighborhood aerial view">
```

Or in SCSS:
```scss
background-image: url('/assets/images/hero-neighborhood.jpg');
```

## Existing Files (to remove before launch)

The following files in this directory are leftover from the previous Open Coding Society template and should be deleted:

- `Bossleft.png`, `Bossright.png` — game sprites
- `Coconut.png`, `Key.png`, `Pina-Colada.png` — game assets
- `Pirate.png`, `Red-Goblin.png` — game sprites
- `archie_single.png`, `boss.png`, `bossMap.png`, `mcarchie.png` — game assets
- `background.png` — game background
- `ocs-logo.png` — Open Coding Society branding
- `pot-of-gold.png` — game asset

## Photo Guidelines

- Preferred format: JPG (photos), PNG (logos/graphics)
- Minimum resolution: 1200px wide for hero images, 800px for cards
- PNEC branding colors: Navy `#0a1628`, Red `#c0392b`
- Always caption photos with credit and date for archiving purposes
- Obtain written permission from individuals shown in photos before publishing
