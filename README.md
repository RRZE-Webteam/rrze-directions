# RRZE Directions

[![Version](https://img.shields.io/github/package-json/v/rrze-webteam/rrze-directions/main?label=Version)](https://github.com/RRZE-Webteam/rrze-directions)
[![Release Version](https://img.shields.io/github/v/release/rrze-webteam/rrze-directions?label=Release+Version)](https://github.com/RRZE-Webteam/rrze-directions/releases/)
[![GitHub License](https://img.shields.io/github/license/rrze-webteam/rrze-directions)](https://github.com/RRZE-Webteam/rrze-directions)
[![GitHub issues](https://img.shields.io/github/issues/rrze-webteam/rrze-directions)](https://github.com/RRZE-Webteam/rrze-directions/issues)

---

## Overview

**RRZE Directions** provides a Gutenberg block for university websites that combines workplace address data from **RRZE-FAUdir** with maps and route descriptions for visitors.

The block is intended for “Anfahrt” / directions pages. You can select a person and workplace in the editor so the plugin fills in address fields, coordinates, an embedded FAU campus map, and optional route maps with turn-by-turn directions.

You can also use the block without FAUdir data: set the destination on [karte.fau.de](https://karte.fau.de/), paste that iframe link in the block sidebar, or enter latitude and longitude directly.

---

## Features

- **Optional FAUdir integration:** Person and workplace selection in the block editor.
- **Manual destination:** karte.fau.de iframe URL or coordinates (no FAUdir selection required).
- **Structured address output:** Organisation, room, floor, street, formatted address.
- **External map links:** Coordinates with links to Google Maps and Apple Maps.
- **FAU campus map:** Embedded map via the official karte.fau.de iframe API, with optional illustration image.
- **Route maps:** Leaflet maps with geometry from OpenRouteService for walking/cycling, car, and public transport.
- **Interactive directions:** Numbered steps linked to map segments; rich-text sections editable in the editor.
- **PDF export:** Optional route map download on the frontend.
- **Start points:** Pill buttons per transport mode; VGN timetable links for regional train stations.
- **Editor preview:** SVG placeholders instead of live maps.
- **Scroll-friendly FAU iframe:** Page scrolls by default; map controls remain clickable.
- **API caching:** Persistent cache for external API responses with automatic and manual invalidation.
- **Admin tours:** About guide and contextual setup tour on the settings page.
- **German translation:** de_DE locale included.

---

## Block

**RRZE Directions Block**

Insert the block on a directions page. Choose a person and workplace from FAUdir, or set the destination manually via a karte.fau.de link or coordinates. The sidebar lets you edit directions text, configure map options, and control start points. The editor preview uses SVG placeholders instead of live maps.

---

## Requirements

- WordPress 6.8 or newer
- PHP 8.2 or newer
- **OpenRouteService API key** for route maps and auto-generated directions (Settings → RRZE Directions)

**RRZE-FAUdir** is optional. Without it, set the destination manually via a karte.fau.de link or coordinates (see below).

---

## Configuration

### Destination without FAUdir

Leave the FAUdir person unselected and set the destination in the block sidebar under **Map**:

1. Open [karte.fau.de](https://karte.fau.de/), navigate to the destination, and copy the iframe link from the map service; paste it into **Link to karte.fau.de**, or
2. Enter **Latitude** and **Longitude** in decimal degrees (for example 49.4550 and 11.0770).

The plugin embeds the FAU campus map from that link or those coordinates and uses them for external map links and route maps.

### OpenRouteService

Under **Settings → RRZE Directions**, enter your OpenRouteService API key. Without a key, address and FAU map features still work; route maps and fetched directions are unavailable.

Changing the API key automatically clears cached OpenRouteService responses.

### FAU campus map URL

With a FAUdir person selected, the plugin can derive a karte.fau.de iframe URL from workplace data. You can also paste a URL manually or rely on coordinates as described above. The map service API is documented at [karte.fau.de/api/doc](https://karte.fau.de/api/doc).

### API caching

To reduce load on external services and speed up frontend rendering, RRZE Directions caches API responses in the WordPress database.

**What is cached**

| Source | Content |
|--------|---------|
| FAUdir | Person and workplace lists for the block editor |
| karte.fau.de (iframe) | Resolved iframe URLs after HTTP redirects |
| karte.fau.de (GeoJSON) | Building and location data from the map API |
| OpenRouteService | Route geometry and directions per start/end coordinates and language |

**Retention**

- Successful responses are stored permanently until you clear the cache or the plugin invalidates them.
- Failed or empty lookups are kept for seven days only.

**Automatic invalidation**

- Saving or updating a FAUdir person entry clears the FAUdir cache group for that site.
- Changing the OpenRouteService API key clears the OpenRouteService cache group.

**Manual cache clear**

Under **Settings → RRZE Directions**, use **Clear API cache** to remove all stored API responses at once. This is useful after address or map data changes if the frontend still shows outdated routes or map pins.

The settings page shows how many cached responses are currently stored.

### About and setup tour

On the settings page, **About** opens a short introduction to the plugin. **Tour** starts a contextual walkthrough of the API key field, save button, cache overview, and optional cache-clear action.

---

## External services

- **[RRZE-FAUdir](https://github.com/RRZE-Webteam/rrze-faudir)** — optional person and workplace data
- **[FAU map service](https://karte.fau.de/)** — iframe and GeoJSON API
- **[OpenRouteService](https://openrouteservice.org)** — route geometry and directions
- **[Carto / OpenStreetMap](https://wiki.openstreetmap.org/wiki/OpenStreetMap_Carto)** — map tiles for route maps
- **[VGN](https://www.vgn.de/verbindungen/)** — timetable links for selected regional stations

---

## Credits

Developed and maintained by the  
**RRZE Webteam, Friedrich-Alexander-Universität Erlangen-Nürnberg (FAU)**  
👉 [https://github.com/RRZE-Webteam/rrze-directions](https://github.com/RRZE-Webteam/rrze-directions)
