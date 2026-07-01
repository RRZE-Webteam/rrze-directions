=== RRZE Directions ===
Contributors: rrze-webteam
Tags: directions, map, fau, gutenberg, block, faudir, openrouteservice
Requires at least: 6.8
Tested up to: 6.8
Requires PHP: 8.2
Stable tag: 1.2.1
License: GPLv3
License URI: https://www.gnu.org/licenses/gpl-3.0.html

Arrival and directions as a Gutenberg block with FAU campus maps and OpenRouteService route descriptions.

== Description ==

RRZE Directions provides a Gutenberg block for university websites that combines workplace address data from RRZE-FAUdir with maps and route descriptions for visitors.

The block is intended for “Anfahrt” / directions pages. You can select a person and workplace in the editor so the plugin fills in address fields, coordinates, an embedded FAU campus map, and optional route maps with turn-by-turn directions.

You can also use the block without FAUdir data: set the destination on karte.fau.de, paste that iframe link in the block sidebar, or enter latitude and longitude directly.

= Features =

* Gutenberg block with optional person and workplace selection from RRZE-FAUdir
* Manual destination via karte.fau.de URL or coordinates (no FAUdir selection required)
* Structured address output (organisation, room, floor, street, formatted address)
* Coordinates with links to Google Maps and Apple Maps
* Embedded map via the official FAU map service iframe API (karte.fau.de)
* Optional illustration image below the map
* Route maps (Leaflet) with geometry from OpenRouteService for walking/cycling, car, and public transport
* Numbered route steps; clicking a step highlights the corresponding segment on the map
* PDF export of the route map 
* Rich-text directions sections, editable in the block editor
* Start-point pill buttons per transport mode; VGN timetable links for regional train stations
* Editor preview with SVG placeholders instead of live maps
* Scroll-friendly FAU iframe: page scrolls by default; map controls remain clickable
* Persistent API response cache for faster page loads
* About guide and contextual setup tour on the settings page
* German translation (de_DE)

= External services =

* RRZE-FAUdir — https://github.com/RRZE-Webteam/rrze-faudir (optional person and workplace data)
* FAU map service — https://karte.fau.de/ (iframe and GeoJSON API)
* OpenRouteService — https://openrouteservice.org (route geometry and directions)
* Carto / OpenStreetMap — https://wiki.openstreetmap.org/wiki/OpenStreetMap_Carto (map tiles for route maps)
* VGN — https://www.vgn.de/verbindungen/ (timetable links for selected regional stations)

== Requirements ==

* WordPress 6.8 or newer
* PHP 8.2 or newer
* OpenRouteService API key for route maps and auto-generated directions (Settings → RRZE Directions)

RRZE-FAUdir is optional. Without it, set the destination manually via a karte.fau.de link or coordinates (see below).

== Configuration ==

= Destination without FAUdir =

Leave the FAUdir person unselected and set the destination in the block sidebar under **Map**:

1. Open https://karte.fau.de/, navigate to the destination, and copy the iframe link from the map service; paste it into **Link to karte.fau.de**, or
2. Enter **Latitude** and **Longitude** in decimal degrees (for example 49.4550 and 11.0770).

The plugin embeds the FAU campus map from that link or those coordinates and uses them for external map links and route maps.

= OpenRouteService =

Under **Settings → RRZE Directions**, enter your OpenRouteService API key. Without a key, address and FAU map features still work; route maps and fetched directions are unavailable.

Changing the API key automatically clears cached OpenRouteService responses.

= FAU campus map URL =

With a FAUdir person selected, the plugin can derive a karte.fau.de iframe URL from workplace data. You can also paste a URL manually or rely on coordinates as described above. The map service API is documented at https://karte.fau.de/api/doc

= API caching =

To reduce load on external services and speed up frontend rendering, RRZE Directions caches API responses in the WordPress database.

**What is cached**

* **FAUdir** — person and workplace lists used in the block editor
* **karte.fau.de (iframe)** — resolved iframe URLs after HTTP redirects
* **karte.fau.de (GeoJSON)** — building and location data from the map API
* **OpenRouteService** — route geometry and directions per start/end coordinates and language

**How long entries are kept**

* Successful responses are stored permanently until you clear the cache or the plugin invalidates them.
* Failed or empty lookups are kept for seven days only.

**Automatic invalidation**

* Saving or updating a FAUdir person entry clears the FAUdir cache group for that site.
* Changing the OpenRouteService API key clears the OpenRouteService cache group.

**Manual cache clear**

Under **Settings → RRZE Directions**, use **Clear API cache** to remove all stored API responses at once. This is useful after address or map data changes if the frontend still shows outdated routes or map pins.

The settings page shows how many cached responses are currently stored.

= About and setup tour =

On the settings page, **About** opens a short introduction to the plugin. **Tour** starts a contextual walkthrough of the API key field, save button, cache overview, and optional cache-clear action.
