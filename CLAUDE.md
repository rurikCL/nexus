# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Full dev environment (recommended):**
```bash
composer dev
# Runs concurrently: php artisan serve | queue:listen | pail (logs) | npm run dev (Vite HMR)
```

**Individual processes:**
```bash
php artisan serve          # Laravel on :8000
npm run dev                # Vite HMR
npm run build              # Production frontend build
php artisan queue:listen   # Background jobs
```

**Database:**
```bash
php artisan migrate
php artisan migrate:fresh --seed
php artisan tinker
```

**Tests:**
```bash
composer test              # Clears config cache then runs PHPUnit
php artisan test --filter=ClassName        # Single test class
php artisan test --filter=test_method_name # Single test method
vendor/bin/pint            # PHP code style fixer (Laravel Pint)
```

**First-time setup:**
```bash
composer setup  # install + .env + key:generate + migrate + npm install + build
```

## Architecture

### Stack
Laravel 12 (API-only backend) + React 18 SPA (no Inertia/SSR despite the package being present). The app authenticates via Sanctum Bearer tokens stored in `localStorage` (`nx-token`, `nx-user`). All frontend code lives in `resources/js/`.

### Auth & Boot Flow
`resources/js/app.jsx` is the React entry point. It reads `nx-token` from localStorage, validates it against `GET /api/me`, and either renders `<Login>` or `<App>`. Token is injected into every Axios request by the interceptor in `api/client.js`.

### Frontend Structure
```
resources/js/
├── app.jsx              # Root: auth state, Pusher queue, user cache
├── App.jsx              # Shell: sidebar nav, header, section router (hash-based)
├── sections/            # One file per route: Comando, Combates, Entrenamiento, etc.
├── components/
│   ├── ui.jsx           # All shared HUD components (Panel, Btn, Chip, Avatar, etc.)
│   └── TransmisionOverlay.jsx  # Full-screen real-time notification
├── store/useStore.js    # Global state (Zustand-like) — persists to localStorage as nx-state-v3
├── api/client.js        # Axios instance with Bearer interceptor
├── api/endpoints.js     # API contract (used for reference; fetch() used directly in components)
├── data/seed.js         # Static catalogs: NX.TIERS, NX.CLASSES, NX.MEDALS, NX.SABERS
└── styles/
    ├── tokens.css       # CSS variables: brand colors, spacing, typography
    └── hud.css          # HUD component styles, animations, responsive grid
```

**Navigation:** hash-based (`#comando`, `#personaje`, etc.). Add new routes to the `NAV` array and `VIEWS` map in `App.jsx`.

**Design system:** Custom sci-fi HUD — dark space background, cyan holographic accent (`--holo`), Orbitron display font, JetBrains Mono data font. See `docs/NEXUS_UI.md` for the full component reference. The holo color changes globally based on the user's saber color via CSS variables.

### Backend Structure
Standard Laravel with API controllers only. All routes are in `routes/api.php` under `auth:sanctum` middleware (except login/register).

```
app/
├── Http/Controllers/Api/   # One controller per resource
├── Models/                 # Eloquent models (SoftDeletes on all map_* tables)
└── ...
```

**Map data hierarchy:** `map_sistemas` → `map_planetas` → `map_zonas` → `map_lugares` → `map_npcs`. All map models use PascalCase FK columns (`SistemaID`, `PlanetaID`, `ZonaID`, `LugarID`). No map API controllers exist yet — they need to be created following the same pattern as existing controllers.

### Real-time
Pusher broadcasts to private channel `App.Models.User.{userId}`. Laravel Echo is initialized in `bootstrap.js`. The overlay queue in `app.jsx` serializes notifications so only one shows at a time.

### Database
MySQL (local: Docker on port 33066 via `host.docker.internal`). Sessions, cache, and queue all use the `database` driver.

### Adding a New Page
1. Create the view component in `resources/js/sections/`
2. Import it in `App.jsx`
3. Add entry to `NAV` array (id, label, icon) and `TITLES` map
4. Add to `VIEWS` map — receives `S` (store), `user`, and `go` (navigation fn)
5. If backend needed: create controller in `app/Http/Controllers/Api/`, add route to `routes/api.php`
