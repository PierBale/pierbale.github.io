# Pier Balestrucci — Personal Website

Static portfolio hosted with GitHub Pages.

## Project structure

```text
.
├── index.html                 # Homepage
├── publications/
│   └── index.html             # Selected publications and posters
├── projects/
│   └── index.html             # Research projects
├── news/
│   ├── index.html             # 2026 news
│   ├── 2025/index.html
│   ├── 2024/index.html
│   ├── 2023/index.html
│   └── 2022/index.html
├── elsewhere/
│   └── index.html             # Browser game
├── hobbies/
│   └── index.html             # Personal interests
├── assets/
│   ├── css/styles.css
│   ├── js/arcade.js
│   ├── icons/
│   ├── images/
│   └── docs/
├── .nojekyll
└── .gitignore
```

Every public page uses a directory-based route, so URLs do not expose `.html`:

- `/publications/`
- `/projects/`
- `/news/`
- `/news/2025/`
- `/elsewhere/`
- `/hobbies/`

Only `index.html` files remain because GitHub Pages uses them as the default document for each route.

## Publishing

Deploy from the `main` branch and the repository root (`/(root)`).
