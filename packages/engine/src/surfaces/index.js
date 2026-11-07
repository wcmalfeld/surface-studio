// Surface library registry. To add a surface, append a definition below (or
// call registerSurface at runtime). A definition is pure data plus a generator
// function, so new categories and materials never touch the compositor.
import { paper, collage, photo } from './paper.js';
import { whiteboard, chalkboard, glassboard, corkboard, foamboard } from './boards.js';
import { concrete, brick, stucco, tiles, metal, wood, sign } from './walls.js';
import { cardboard, sleeve, fabric, bookCover, sticker, skateboard, vehicle, rock, bark, ground, fogWindow, poster, mapSheet, magazine, projection } from './objects.js';

export const CATEGORIES = [
  { id: 'paper', name: 'Paper & stationery' },
  { id: 'boards', name: 'Boards' },
  { id: 'architecture', name: 'Buildings' },
  { id: 'objects', name: 'Everyday objects' },
  { id: 'outdoor', name: 'Outdoors' },
  { id: 'experimental', name: 'Experimental' },
];

/**
 * Fields:
 *  id, name, category, gen, params
 *  kind: 'object' (a thing in a scene) | 'expanse' (fills the view: walls, ground)
 *  aspect: plane width/height for objects
 *  treatments: recommended, best first
 *  tone: 'light' | 'dark' (drives default ink)
 *  ink: optional {treatmentId|default: color}
 *  env: environment for in-context shots; wide: framing for expanses ('wall'|'ground'|'board')
 *  maxWords: comfortable text length before we warn
 *  keywords: words that map a free-text scene prompt to this surface
 */
const D = [];
const add = (def) => D.push({ kind: 'object', aspect: 1, tone: 'light', maxWords: 60, env: 'desk-wood', keywords: [], params: {}, ...def });

// ---------- A. Paper & stationery ----------
add({ id: 'notebook', name: 'Notebook page', category: 'paper', gen: paper, params: { lines: 'ruled', marginLine: true, spiral: true, color: '#fbfaf3' }, aspect: 0.78, treatments: ['handwritten', 'finepen', 'pencil'], keywords: ['notebook', 'spiral', 'school'] });
add({ id: 'journal', name: 'Journal page', category: 'paper', gen: paper, params: { lines: 'dots', color: '#f4ebd8', lineColor: '#a59a85', age: 0.12, edge: 'deckle', gridGap: 34 }, aspect: 0.72, env: 'desk-dark', treatments: ['finepen', 'handwritten', 'pencil'], keywords: ['journal', 'diary', 'bullet journal', 'moleskine'] });
add({ id: 'looseleaf', name: 'Loose-leaf', category: 'paper', gen: paper, params: { lines: 'ruled', marginLine: true, holes: true, color: '#fdfdf9' }, aspect: 0.77, treatments: ['handwritten', 'pencil', 'finepen'], keywords: ['loose-leaf', 'looseleaf', 'binder', 'lined paper'] });
add({ id: 'graph', name: 'Graph paper', category: 'paper', gen: paper, params: { lines: 'graph', color: '#f9fbfa', lineColor: '#5fa79e', gridGap: 28 }, aspect: 0.77, env: 'desk-concrete', treatments: ['pencil', 'finepen', 'handwritten'], keywords: ['graph', 'grid', 'engineering', 'math'] });
add({ id: 'torn', name: 'Torn paper', category: 'paper', gen: paper, params: { lines: 'none', edge: 'torn-all', color: '#fbfaf5', marginX: 110 }, aspect: 1.2, env: 'linen', treatments: ['handwritten', 'marker', 'typewriter'], keywords: ['torn', 'scrap', 'ripped'] });
add({ id: 'crumpled', name: 'Crumpled paper', category: 'paper', gen: paper, params: { lines: 'ruled', crumple: 1, color: '#fbfaf4', topMargin: 80 }, aspect: 0.8, env: 'desk-concrete', treatments: ['handwritten', 'pencil', 'marker'], keywords: ['crumpled', 'wrinkled', 'crushed'] });
add({ id: 'sticky', name: 'Sticky note', category: 'paper', gen: paper, params: { lines: 'none', color: '#fff17a', curl: true, marginX: 80, topMargin: 120, fibers: 200 }, aspect: 1, treatments: ['marker', 'handwritten', 'finepen'], maxWords: 25, keywords: ['sticky', 'post-it', 'postit', 'note'] });
add({ id: 'parchment', name: 'Vintage parchment', category: 'paper', gen: paper, params: { lines: 'none', color: '#e8d4a4', age: 0.75, edge: 'deckle', texture: 'laid', stains: true, marginX: 120 }, aspect: 0.75, env: 'desk-dark', treatments: ['finepen', 'handwritten', 'printed'], ink: { default: '#3a2414' }, keywords: ['parchment', 'old', 'ancient', 'letter', 'scroll', 'antique'] });
add({ id: 'newspaper', name: 'Newspaper', category: 'paper', gen: paper, params: { lines: 'news', color: '#ece6d6', age: 0.25 }, aspect: 0.75, treatments: ['printed', 'typewriter', 'marker'], ink: { marker: '#c62828' }, keywords: ['newspaper', 'news', 'headline', 'press'] });
add({ id: 'receipt', name: 'Receipt', category: 'paper', gen: paper, params: { lines: 'receipt', edge: 'zigzag-bottom', color: '#fbfbf6', crumple: 0.18 }, aspect: 0.45, env: 'marble', treatments: ['typewriter', 'printed', 'handwritten'], maxWords: 40, ink: { typewriter: '#2c2a33', printed: '#2c2a33' }, keywords: ['receipt', 'till', 'bill', 'thermal'] });
add({ id: 'envelope', name: 'Envelope', category: 'paper', gen: paper, params: { lines: 'envelope', color: '#f1e6cf' }, aspect: 1.55, treatments: ['handwritten', 'finepen', 'typewriter'], maxWords: 30, keywords: ['envelope', 'mail', 'letter', 'post'] });
add({ id: 'indexcard', name: 'Index card', category: 'paper', gen: paper, params: { lines: 'index', color: '#fdfdf8', lineGap: 38 }, aspect: 1.65, treatments: ['handwritten', 'marker', 'typewriter'], maxWords: 40, keywords: ['index card', 'flashcard', 'recipe card'] });
add({ id: 'bookpage', name: 'Book page', category: 'paper', gen: paper, params: { lines: 'book', color: '#f1e8d3', gutter: true, age: 0.18 }, aspect: 0.66, env: 'desk-dark', treatments: ['printed', 'typewriter', 'pencil'], keywords: ['book', 'page', 'novel', 'paperback'] });

// ---------- B. Boards ----------
add({ id: 'whiteboard', name: 'Whiteboard', category: 'boards', gen: whiteboard, aspect: 1.5, env: 'office', treatments: ['marker'], ink: { marker: '#1f3c94' }, keywords: ['whiteboard', 'dry erase', 'meeting'] });
add({ id: 'chalkboard', name: 'Chalkboard', category: 'boards', gen: chalkboard, params: { color: '#2b302d' }, aspect: 1.45, env: 'classroom', tone: 'dark', treatments: ['chalk'], keywords: ['chalkboard', 'blackboard', 'chalk', 'menu board'] });
add({ id: 'glassboard', name: 'Glass board', category: 'boards', gen: glassboard, aspect: 1.5, env: 'office', treatments: ['marker'], ink: { marker: '#10161f' }, keywords: ['glass', 'glassboard', 'office'] });
add({ id: 'classroom', name: 'Classroom board', category: 'boards', gen: chalkboard, params: { color: '#2f4b3b' }, aspect: 1.7, env: 'classroom', tone: 'dark', treatments: ['chalk'], keywords: ['classroom', 'green board', 'lecture', 'teacher'] });
add({ id: 'presentation', name: 'Presentation board', category: 'boards', gen: foamboard, aspect: 1.33, env: 'office', treatments: ['marker', 'printed'], keywords: ['presentation', 'poster board', 'foam board', 'easel'] });
add({ id: 'bulletin', name: 'Bulletin board', category: 'boards', gen: corkboard, aspect: 1.4, env: 'office', treatments: ['marker', 'handwritten'], maxWords: 30, keywords: ['bulletin', 'cork', 'pinboard', 'notice board'] });

// ---------- C. Buildings & architecture ----------
const wallInk = { paint: '#f4f0e6', spray: '#ff4a36', chalk: '#ffffff', marker: '#111111' };
add({ id: 'concrete', name: 'Concrete wall', category: 'architecture', kind: 'expanse', gen: concrete, params: { formwork: true }, wide: 'wall', env: 'street', treatments: ['paint', 'spray', 'chalk'], ink: { ...wallInk, paint: '#151515' }, keywords: ['concrete', 'brutalist', 'cement'] });
add({ id: 'brick', name: 'Brick wall', category: 'architecture', kind: 'expanse', gen: brick, wide: 'wall', env: 'street', treatments: ['paint', 'spray', 'chalk'], ink: wallInk, keywords: ['brick', 'bricks', 'alley'] });
add({ id: 'painted', name: 'Painted wall', category: 'architecture', kind: 'expanse', gen: stucco, params: { color: '#2f6f7f', grime: 0.4 }, wide: 'wall', env: 'street', tone: 'dark', treatments: ['paint', 'spray'], ink: { paint: '#f6e8c7', spray: '#ffd23f' }, keywords: ['painted wall', 'mural', 'teal', 'colorful wall'] });
add({ id: 'warehouse', name: 'Old warehouse wall', category: 'architecture', kind: 'expanse', gen: stucco, params: { color: '#cfc8b8', peel: true, rust: true, grime: 1.1 }, wide: 'wall', env: 'street', treatments: ['paint', 'spray'], ink: { paint: '#1b1b1b', spray: '#1b1b1b' }, keywords: ['warehouse', 'factory', 'abandoned', 'peeling'] });
add({ id: 'woodwall', name: 'Wooden wall', category: 'architecture', kind: 'expanse', gen: wood, params: { orientation: 'v', boards: 7, weathered: true, color: '#8a6a4a' }, wide: 'wall', env: 'street', treatments: ['paint', 'marker', 'spray'], ink: wallInk, keywords: ['barn', 'wooden wall', 'cabin', 'shed'] });
add({ id: 'subway', name: 'Subway tiles', category: 'architecture', kind: 'expanse', gen: tiles, params: { color: '#f0eee6', band: '#2d64a8' }, wide: 'wall', env: 'street-night', treatments: ['spray', 'marker', 'paint'], ink: { spray: '#141414', marker: '#141414', paint: '#c0392b' }, keywords: ['subway', 'metro', 'tile', 'station', 'underground'] });
add({ id: 'industrial', name: 'Industrial metal', category: 'architecture', kind: 'expanse', gen: metal, params: { corrugated: true, color: '#7d8b94', rust: 0.35 }, wide: 'wall', env: 'street', treatments: ['spray', 'paint'], ink: { spray: '#ffd23f', paint: '#f4f0e6' }, keywords: ['metal', 'corrugated', 'industrial', 'steel', 'shipping container', 'container'] });
add({ id: 'facade', name: 'Building facade', category: 'architecture', kind: 'expanse', gen: stucco, params: { color: '#d48a5e', grime: 0.6 }, wide: 'wall', env: 'street', treatments: ['paint', 'spray'], ink: { paint: '#fdf5e4', spray: '#1e2a44' }, keywords: ['building', 'facade', 'storefront', 'side of a building'] });
add({ id: 'extsign', name: 'Exterior sign', category: 'architecture', gen: sign, params: { style: 'board', paint: '#1f2e46', border: '#e8c46a', boards: 2 }, aspect: 2.6, env: 'wall-brick', treatments: ['paint', 'printed'], maxWords: 14, ink: { default: '#f3e3b8' }, tone: 'dark', keywords: ['shop sign', 'storefront sign', 'exterior sign', 'signage'] });

// ---------- D. Everyday objects ----------
add({ id: 'cardboard', name: 'Cardboard', category: 'objects', gen: cardboard, params: { torn: true, dents: true }, aspect: 1.25, env: 'asphalt', treatments: ['marker', 'paint', 'handwritten'], ink: { marker: '#141414', paint: '#141414', handwritten: '#141414' }, maxWords: 30, keywords: ['cardboard', 'protest', 'sign', 'cardboard sign'] });
add({ id: 'paperbag', name: 'Paper bag', category: 'objects', gen: paper, params: { lines: 'none', texture: 'kraft', color: '#c49a68', folds: 2, edge: 'zigzag-bottom', marginX: 110, topMargin: 150 }, aspect: 0.72, treatments: ['marker', 'handwritten'], ink: { default: '#1d1611' }, keywords: ['paper bag', 'lunch bag', 'kraft', 'grocery bag'] });
add({ id: 'sleeve', name: 'Coffee cup sleeve', category: 'objects', gen: sleeve, aspect: 2.3, env: 'marble', treatments: ['marker', 'handwritten'], maxWords: 12, ink: { default: '#1d1611' }, keywords: ['coffee', 'cup', 'sleeve', 'cafe', 'barista'] });
add({ id: 'napkin', name: 'Napkin', category: 'objects', gen: paper, params: { lines: 'none', texture: 'emboss', color: '#fbfaf6', crumple: 0.25, marginX: 130, topMargin: 130 }, aspect: 1, env: 'marble', bleed: 0.8, treatments: ['handwritten', 'finepen', 'marker'], maxWords: 35, keywords: ['napkin', 'serviette', 'diner', 'bar'] });
add({ id: 'planks', name: 'Wooden planks', category: 'objects', kind: 'expanse', gen: wood, params: { orientation: 'h', boards: 4, nails: true, color: '#a5764c' }, wide: 'ground', env: 'desk-dark', treatments: ['paint', 'marker'], ink: { paint: '#f4f0e6', marker: '#141414' }, keywords: ['plank', 'wood', 'wooden', 'deck', 'boards', 'pallet'] });
add({ id: 'fabric', name: 'Fabric', category: 'objects', gen: fabric, params: { color: '#e4d9c6' }, aspect: 1.15, env: 'desk-wood', treatments: ['marker', 'paint', 'printed'], keywords: ['fabric', 'canvas', 'tote', 'linen', 'cloth', 'shirt'] });
add({ id: 'denim', name: 'Denim', category: 'objects', gen: fabric, params: { color: '#3b5b86', denim: true, weave: 4 }, aspect: 1.15, env: 'desk-wood', tone: 'dark', treatments: ['paint', 'marker'], ink: { default: '#f3efe6' }, keywords: ['denim', 'jeans', 'jacket'] });
add({ id: 'packaging', name: 'Shipping box', category: 'objects', gen: cardboard, params: { tape: true, box: true }, aspect: 1.3, env: 'desk-concrete', treatments: ['marker', 'printed', 'spray'], ink: { default: '#141414' }, keywords: ['box', 'package', 'packaging', 'shipping', 'parcel'] });
add({ id: 'bookcover', name: 'Cloth book cover', category: 'objects', gen: bookCover, params: { color: '#2f4a3a', band: true }, aspect: 0.7, env: 'desk-dark', tone: 'dark', treatments: ['printed', 'paint'], ink: { default: '#e3cf91' }, maxWords: 20, keywords: ['book cover', 'hardcover', 'cloth', 'gold foil'] });
add({ id: 'kraftbook', name: 'Kraft notebook', category: 'objects', gen: paper, params: { lines: 'none', texture: 'kraft', color: '#b88b5a', corner: 22, marginX: 120, topMargin: 180 }, aspect: 0.72, treatments: ['marker', 'handwritten', 'printed'], ink: { default: '#1d1611' }, maxWords: 25, keywords: ['notebook cover', 'kraft notebook', 'field notes'] });
add({ id: 'streetsign', name: 'Street sign', category: 'objects', gen: sign, params: { style: 'street' }, pole: true, aspect: 3, env: 'street', tone: 'dark', treatments: ['printed'], maxWords: 8, ink: { default: '#f7f7f2' }, keywords: ['street sign', 'road sign', 'highway'] });
add({ id: 'sticker', name: 'Sticker', category: 'objects', gen: sticker, aspect: 1.3, env: 'laptop', treatments: ['marker', 'printed'], maxWords: 14, ink: { default: '#1a1a1a' }, keywords: ['sticker', 'laptop', 'decal'] });

// ---------- E. Outdoor & unconventional ----------
add({ id: 'rock', name: 'Rock', category: 'outdoor', gen: rock, params: { lichen: true }, aspect: 1.3, env: 'forest', treatments: ['paint', 'chalk', 'marker'], maxWords: 20, ink: { paint: '#f4f0e6', chalk: '#ffffff', marker: '#111111' }, keywords: ['rock', 'stone', 'boulder', 'pebble'] });
add({ id: 'tree', name: 'Tree trunk', category: 'outdoor', kind: 'expanse', wide: 'trunk', gen: bark, aspect: 0.85, env: 'forest', treatments: ['paint', 'marker'], maxWords: 16, ink: { default: '#2b1a10' }, keywords: ['tree', 'trunk', 'bark', 'carved'] });
add({ id: 'pavement', name: 'Pavement', category: 'outdoor', kind: 'expanse', gen: ground, params: { kind: 'asphalt', lineColor: '#e8c547' }, wide: 'ground', env: 'street', tone: 'dark', treatments: ['chalk', 'spray', 'paint'], ink: { chalk: '#f6f2e8', spray: '#ffffff', paint: '#ffffff' }, porous: 0.45, keywords: ['pavement', 'asphalt', 'road', 'parking lot'] });
add({ id: 'sidewalk', name: 'Sidewalk chalk', category: 'outdoor', kind: 'expanse', gen: ground, params: { kind: 'sidewalk' }, wide: 'ground', env: 'street', treatments: ['chalk'], ink: { chalk: '#e2457c' }, keywords: ['sidewalk', 'sidewalk chalk', 'footpath'] });
add({ id: 'trailsign', name: 'Trail sign', category: 'outdoor', pole: true, gen: sign, params: { style: 'board', color: '#5a3b22', weathered: true, boards: 2 }, aspect: 2.4, env: 'forest', tone: 'dark', treatments: ['paint', 'marker'], maxWords: 14, ink: { default: '#efd27e' }, keywords: ['trail', 'hiking', 'park', 'trailhead', 'forest sign'] });
add({ id: 'fence', name: 'Fence', category: 'outdoor', kind: 'expanse', gen: wood, params: { orientation: 'v', boards: 8, weathered: true, nails: true, color: '#9a7a58' }, wide: 'wall', env: 'forest', treatments: ['paint', 'spray', 'chalk'], ink: wallInk, keywords: ['fence', 'picket', 'backyard'] });
add({ id: 'window', name: 'Foggy window', category: 'outdoor', kind: 'expanse', gen: fogWindow, params: { night: true }, wide: 'board', env: 'night', tone: 'dark', treatments: ['impressed'], maxWords: 20, keywords: ['window', 'fog', 'foggy', 'steam', 'condensation', 'rain', 'glass'] });
add({ id: 'snow', name: 'Snow', category: 'outdoor', kind: 'expanse', gen: ground, params: { kind: 'snow' }, wide: 'ground', env: 'snowfield', treatments: ['impressed'], maxWords: 14, keywords: ['snow', 'winter', 'frost'] });
add({ id: 'sand', name: 'Sand', category: 'outdoor', kind: 'expanse', gen: ground, params: { kind: 'sand' }, wide: 'ground', env: 'beach', treatments: ['impressed'], maxWords: 14, keywords: ['sand', 'beach', 'shore', 'desert'] });
add({ id: 'skateboard', name: 'Skateboard deck', category: 'outdoor', gen: skateboard, aspect: 3.6, env: 'asphalt', treatments: ['marker', 'paint', 'spray'], maxWords: 10, ink: { default: '#151515' }, keywords: ['skateboard', 'skate', 'deck'] });
add({ id: 'dustycar', name: 'Dusty car window', category: 'outdoor', gen: vehicle, params: { dusty: true }, aspect: 1.9, env: 'street', treatments: ['impressed'], maxWords: 12, keywords: ['car', 'dusty', 'dirty window', 'vehicle', 'truck'] });
add({ id: 'carpaint', name: 'Car door', category: 'outdoor', kind: 'expanse', gen: vehicle, params: { color: '#2a5d8f' }, wide: 'wall', env: 'street', tone: 'dark', treatments: ['paint', 'marker'], maxWords: 12, ink: { default: '#f4f2ea' }, keywords: ['car door', 'van', 'vehicle paint'] });

// ---------- F. Creative & experimental ----------
add({ id: 'poster', name: 'Vintage poster', category: 'experimental', gen: poster, aspect: 0.72, env: 'wall-brick', treatments: ['printed', 'paint'], ink: { default: '#1c3144' }, maxWords: 30, keywords: ['poster', 'vintage poster', 'gig poster', 'flyer'] });
add({ id: 'oldphoto', name: 'Old photograph', category: 'experimental', gen: photo, params: { sepia: 0.55 }, aspect: 1.3, env: 'desk-dark', treatments: ['finepen', 'handwritten', 'marker'], ink: { default: '#fbf6ea' }, tone: 'dark', maxWords: 25, keywords: ['photograph', 'old photo', 'sepia', 'snapshot'] });
add({ id: 'polaroid', name: 'Instant photo', category: 'experimental', gen: photo, params: { polaroid: true, sepia: 0.15, palette: ['#7fb2d6', '#f2d5a8', '#7c8a4c', '#3e4a2c'] }, aspect: 0.84, env: 'linen', treatments: ['marker', 'handwritten'], maxWords: 10, ink: { default: '#1b1b1b' }, keywords: ['polaroid', 'instant', 'instax'] });
add({ id: 'map', name: 'Map', category: 'experimental', gen: mapSheet, aspect: 1.3, treatments: ['handwritten', 'marker', 'typewriter'], ink: { marker: '#b3261e' }, keywords: ['map', 'atlas', 'travel', 'route'] });
add({ id: 'film', name: 'Film photograph', category: 'experimental', gen: photo, params: { border: '#111111', borderSize: 22, sepia: 0.1, lightLeak: true, palette: ['#3e6f9c', '#f0a96b', '#6a5a3a', '#2a2f22'] }, aspect: 1.5, env: 'studio', tone: 'dark', treatments: ['printed', 'handwritten'], ink: { default: '#fff6e2' }, maxWords: 30, keywords: ['film', '35mm', 'analog', 'kodak', 'light leak'] });
add({ id: 'magazine', name: 'Magazine cutout', category: 'experimental', gen: magazine, aspect: 0.8, env: 'linen', treatments: ['printed', 'marker'], maxWords: 30, keywords: ['magazine', 'cutout', 'zine', 'clipping'] });
add({ id: 'collage', name: 'Collage', category: 'experimental', gen: collage, aspect: 0.9, treatments: ['typewriter', 'printed', 'handwritten'], maxWords: 30, keywords: ['collage', 'scrapbook', 'mixed media'] });
add({ id: 'projection', name: 'Projected writing', category: 'experimental', kind: 'expanse', gen: projection, wide: 'board', env: 'night', tone: 'dark', treatments: ['printed', 'handwritten', 'typewriter'], ink: { default: '#fff4dc' }, keywords: ['projector', 'projected', 'projection', 'light', 'cinema', 'dark room'] });
add({ id: 'streetart', name: 'Street-art wall', category: 'experimental', kind: 'expanse', gen: stucco, params: { color: '#33363d', peel: true, under: '#c94a55', grime: 0.8 }, wide: 'wall', env: 'street-night', tone: 'dark', treatments: ['spray', 'paint'], ink: { spray: '#f7d038', paint: '#f2efe6' }, keywords: ['street art', 'graffiti', 'mural', 'urban', 'tag'] });

export const SURFACES = D;
export const SURFACE_MAP = new Map(D.map((s) => [s.id, s]));

export function registerSurface(def) {
  const full = { kind: 'object', aspect: 1, tone: 'light', maxWords: 60, env: 'desk-wood', keywords: [], params: {}, ...def };
  const i = D.findIndex((s) => s.id === full.id);
  if (i >= 0) D[i] = full; else D.push(full);
  SURFACE_MAP.set(full.id, full);
  return full;
}

export function getSurface(id) { return SURFACE_MAP.get(id) || D[0]; }
