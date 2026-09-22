#!/usr/bin/env node
/**
 * Builds public/data/campus.json from OpenStreetMap: the real footprints of the
 * buildings around the CEG red building, roads, grounds and water — so the
 * drone shot reveals the actual campus layout.
 *
 *   npm run campus:build
 *
 * Coordinates are metres in the experience's world frame: origin at the red
 * building's clock tower, rotated 7.9° so the building's front (south) facade
 * runs along +x, with +z pointing south (toward the front garden).
 * Map data © OpenStreetMap contributors (ODbL).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BBOX = [13.0045, 80.2275, 13.0185, 80.244]; // S, W, N, E
const MAIN_BUILDING_RELATION = 2451721; // "Red Building" (College of Engineering)
const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://lz4.overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];

// World frame (see header).
const LAT0 = 13.011217993150686;
const LON0 = 80.23551153424658;
const R = 6378137;
const ANGLE = (7.9 * Math.PI) / 180;
const TOWER = { x: -10.0, y: -25.5 };
const PORCH_SHIFT = -1.5;
const RADIUS = 720;

function toWorld(lat, lon) {
  let x = ((lon - LON0) * Math.PI) / 180 * R * Math.cos((LAT0 * Math.PI) / 180);
  let y = ((lat - LAT0) * Math.PI) / 180 * R;
  x -= TOWER.x;
  y -= TOWER.y;
  const xr = x * Math.cos(ANGLE) - y * Math.sin(ANGLE);
  const yr = x * Math.sin(ANGLE) + y * Math.cos(ANGLE);
  return [Math.round((xr + PORCH_SHIFT) * 10) / 10, Math.round(-yr * 10) / 10];
}

const ROAD_WIDTH = { primary: 14, primary_link: 8, secondary: 12, tertiary: 10, residential: 7, living_street: 5.5, service: 5, track: 3.5, footway: 2.2, path: 1.8, pedestrian: 4, cycleway: 2 };

async function overpass(query) {
  for (const url of MIRRORS) {
    try {
      const res = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: query }), headers: { 'User-Agent': 'acm-ceg-world/1.0' } });
      const text = await res.text();
      if (text.trim().startsWith('{')) return JSON.parse(text);
      console.warn(`[campus] ${url} returned non-JSON, trying next mirror`);
    } catch (e) {
      console.warn(`[campus] ${url} failed: ${e.message}`);
    }
  }
  throw new Error('All Overpass mirrors failed');
}

function area(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  return Math.abs(a / 2);
}

function centroid(ring) {
  let x = 0;
  let z = 0;
  for (const p of ring) {
    x += p[0];
    z += p[1];
  }
  return [x / ring.length, z / ring.length];
}

/** Deterministic hash → 0..1 for stable per-building variation. */
function h01(n) {
  let t = (n ^ 0x9e3779b9) >>> 0;
  t = Math.imul(t ^ (t >>> 16), 0x85ebca6b);
  t = Math.imul(t ^ (t >>> 13), 0xc2b2ae35);
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
}

function heightFor(tags, footprint, id) {
  const lv = parseFloat(tags['building:levels']);
  if (Number.isFinite(lv) && lv > 0) return Math.min(40, lv * 3.6 + 1.2);
  const name = (tags.name ?? '').toLowerCase();
  const apartment = /apartment|towers|enclave|residency|flats|terrace|nivas|villa/.test(name) || tags.building === 'apartments';
  const base = apartment ? 13 : footprint < 80 ? 4.2 : footprint < 400 ? 7.6 : footprint < 1500 ? 11 : 13.5;
  return Math.round(base * (0.88 + h01(id) * 0.24) * 10) / 10;
}

const main = async () => {
  const [s, w, n, e] = BBOX;
  const bb = `(${s},${w},${n},${e})`;
  const q = `[out:json][timeout:90];(way["building"]${bb};relation["building"]${bb};way["highway"]${bb};way["leisure"]${bb};way["landuse"]${bb};way["natural"]${bb};way["amenity"="parking"]${bb};relation["building"](id:${MAIN_BUILDING_RELATION}););out geom;`;
  const data = await overpass(q);
  const exclude = new Set();
  for (const el of data.elements) {
    if (el.type === 'relation' && el.id === MAIN_BUILDING_RELATION) for (const m of el.members ?? []) exclude.add(m.ref);
  }

  const buildings = [];
  const roads = [];
  const areas = [];
  let mainBuilding = null;
  const inRange = (ring) => {
    const [cx, cz] = centroid(ring);
    return Math.hypot(cx, cz) < RADIUS;
  };

  for (const el of data.elements) {
    const t = el.tags ?? {};
    if (el.type === 'relation' && el.id === MAIN_BUILDING_RELATION) {
      const outer = el.members.filter((m) => m.role === 'outer' && m.geometry).map((m) => m.geometry.map((g) => toWorld(g.lat, g.lon)));
      const inner = el.members.filter((m) => m.role === 'inner' && m.geometry).map((m) => m.geometry.map((g) => toWorld(g.lat, g.lon)));
      mainBuilding = { outer, inner };
      continue;
    }
    if (el.type === 'way' && exclude.has(el.id)) continue;

    if (t.building) {
      let rings = [];
      let holes = [];
      if (el.type === 'way' && el.geometry) rings = [el.geometry.map((g) => toWorld(g.lat, g.lon))];
      else if (el.type === 'relation') {
        rings = (el.members ?? []).filter((m) => m.role === 'outer' && m.geometry).map((m) => m.geometry.map((g) => toWorld(g.lat, g.lon)));
        holes = (el.members ?? []).filter((m) => m.role === 'inner' && m.geometry).map((m) => m.geometry.map((g) => toWorld(g.lat, g.lon)));
      }
      for (const ring of rings) {
        if (ring.length < 4 || !inRange(ring)) continue;
        const a = area(ring);
        if (a < 12) continue;
        buildings.push({ p: ring, ...(holes.length ? { holes } : {}), h: heightFor(t, a, el.id), v: Math.round(h01(el.id + 7) * 100) / 100, ...(t.name ? { n: t.name.trim() } : {}) });
      }
      continue;
    }
    if (!el.geometry) continue;
    const pts = el.geometry.map((g) => toWorld(g.lat, g.lon));
    if (t.highway && ROAD_WIDTH[t.highway]) {
      if (!pts.some((p) => Math.hypot(p[0], p[1]) < RADIUS + 80)) continue;
      roads.push({ p: pts, w: ROAD_WIDTH[t.highway], k: t.highway });
      continue;
    }
    const kind =
      t.leisure === 'track' ? 'track' :
      t.leisure === 'stadium' ? 'stadium' :
      t.leisure === 'pitch' ? 'pitch' :
      t.leisure === 'swimming_pool' ? 'pool' :
      t.leisure === 'garden' ? 'garden' :
      t.leisure === 'park' || t.leisure === 'playground' || t.leisure === 'golf_course' ? 'park' :
      t.landuse === 'grass' ? 'grass' :
      t.natural === 'water' ? 'water' :
      t.natural === 'wood' ? 'wood' :
      t.amenity === 'parking' ? 'parking' :
      null;
    if (!kind) continue;
    const closed = pts.length > 3 && pts[0][0] === pts.at(-1)[0] && pts[0][1] === pts.at(-1)[1];
    if (!closed || !inRange(pts)) continue;
    areas.push({ p: pts, k: kind });
  }

  const out = {
    source: 'OpenStreetMap contributors (ODbL) — https://www.openstreetmap.org/copyright',
    generated: new Date().toISOString().slice(0, 10),
    frame: 'metres; origin at the CEG red building clock tower; +x along the front facade (east); +z south',
    mainBuilding,
    buildings,
    roads,
    areas,
  };
  const dir = join(process.cwd(), 'public', 'data');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'campus.json'), JSON.stringify(out));
  console.log(`[campus] ${buildings.length} buildings, ${roads.length} roads, ${areas.length} areas → public/data/campus.json`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
