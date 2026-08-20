# Amsterdam × Zandvoort 2026

Mobile-first weekend navigator for an Amsterdam city break and the 2026 Dutch Grand Prix at Circuit Zandvoort.

## Features

- Amsterdam map with the hotel, quiet green spaces, outdoor sights, cafés and affordable food
- Walking and public-transport navigation links
- Hotel check-in, check-out and breakfast information
- Amsterdam Centraal ↔ Zandvoort train guidance and official ticket links
- Dutch GP Sunday schedule, official circuit map and Gold+ information
- PWA manifest, offline shell and custom Dutch F1 weekend icon
- Dark mode, favorites, location-based sorting and emergency contacts
- Optional iPhone Shortcut launchers for locally stored travel documents

## Local travel documents

No identity or insurance document is included in this repository, uploaded to the Site, cached by the service worker or stored by the web app. The two document buttons only launch user-created iPhone Shortcuts named:

- `Personalausweis`
- `Auslandsreiseversicherung`

Each shortcut remains local to the individual iPhone and is responsible for opening the corresponding file from Apple Files.

## Development

Requirements: Node.js `>=22.13.0`.

```bash
npm ci
npm run dev
```

Validate a production build with:

```bash
npm run lint
npm test
```

## Data and attribution

Place data is curated in `app/data.ts`. The application links to official sources for time-sensitive hotel, transit and event information. Map tiles are provided by OpenStreetMap through Leaflet.

This repository intentionally contains no document scans, account credentials or environment files. The project currently has no open-source license; public visibility does not grant additional reuse rights.
