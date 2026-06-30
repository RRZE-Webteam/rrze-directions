=== RRZE Directions ===
Contributors: rrze-webteam
Requires at least: 6.8
Tested up to: 6.8
Requires PHP: 8.2
Stable tag: 1.0.56
License: GPLv3
License URI: https://www.gnu.org/licenses/gpl-3.0.html

Arrival and directions as a Gutenberg block with address data sourced from RRZE-FAUdir.

== Description ==

RRZE Directions provides a Gutenberg block for university websites that combines workplace address data from RRZE-FAUdir with maps and route descriptions for visitors.

The block is intended for “Anfahrt” / directions pages: select a person and workplace in the editor, and the plugin fills in address fields, coordinates, an embedded FAU campus map, and optional route maps with turn-by-turn directions.

= Features =

* Gutenberg block with person and workplace selection from RRZE-FAUdir
* Structured address output (organisation, room, floor, street, formatted address)
* Coordinates with links to Google Maps and Apple Maps
* Embedded map via the official FAU map service iframe API (karte.fau.de)
* Optional illustration image below the map
* Route maps (Leaflet) with geometry from OpenRouteService for walking/cycling, car, and public transport
* Numbered route steps; clicking a step highlights the corresponding segment on the map
* Rich-text directions sections, editable in the block editor
* Show or hide individual directions types per block
* Layout choice: accordion (rrze-answers), tabs, or multi-column grid
* Editor preview with SVG placeholders instead of live maps
* Scroll-friendly FAU iframe: page scrolls by default; map controls remain clickable
* German translation (de_DE)
* Frontend typography is left to the active theme (no plugin font overrides)

= External services =

* RRZE-FAUdir — person and workplace data (required plugin)
* FAU map service — https://karte.fau.de/ (iframe and GeoJSON API)
* OpenRouteService — route geometry and directions (API key required)
* Carto / OpenStreetMap — map tiles for route maps

== Requirements ==

* WordPress 6.8 or newer
* PHP 8.2 or newer
* Active RRZE-FAUdir plugin (same data basis as FAUdir person entries / custom_person)
* OpenRouteService API key for route maps and auto-generated directions (Settings → RRZE Directions)

== Installation ==

1. Ensure RRZE-FAUdir is installed and active.
2. Upload and activate RRZE Directions.
3. Run `npm install && npm run build` if you deploy from source (assets must exist in `/build`).
4. Add the “RRZE Directions” block to a page or post.
5. Enter an OpenRouteService API key under Settings → RRZE Directions if you use route maps or automatic directions.

== Configuration ==

= OpenRouteService =

Under **Settings → RRZE Directions**, enter your OpenRouteService API key. Without a key, address and FAU map features still work; route maps and fetched directions are unavailable.

= FAU campus map URL =

In the block sidebar, paste a karte.fau.de iframe URL or let the plugin derive one from FAUdir / coordinates. The map service API is documented at https://karte.fau.de/api/doc

== Development ==

From the plugin directory:

`npm install`
`npm run build` — compile editor/frontend assets into `/build` and copy `render.php`
`npm run start` — watch mode for development
`npm run lint:js` / `npm run lint:css` — lint sources
`msgfmt -o languages/rrze-directions-de_DE.mo languages/rrze-directions-de_DE.po` — compile German translations

Source layout:

* `src/` — block editor (`edit.js`), styles, route map scripts
* `includes/` — PHP rendering, FAUdir integration, OpenRouteService REST endpoints
* `build/` — compiled assets (committed or generated before release)

== Changelog ==

= 1.0.0 =
* Initial release: FAUdir address block, karte.fau.de embed, OpenRouteService route maps, accordion/columns layouts, editor settings, de_DE translation.
