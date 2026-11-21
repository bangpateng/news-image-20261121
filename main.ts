// news-image-20261121 — "The World Today": one front page summing up
// Saturday 21 November 2026. Written fresh in this session for @nax.
// Node 22, standard library only, no network, fully deterministic:
// the same bytes come out of every run.
//
// The image is a newspaper front page: a masthead with the date, a lead
// story (Russian missiles crash in Poland) with a drawn night scene, six
// story cards, and a bottom strip. Every letter is drawn from a small
// 5x7 bitmap font defined below, and the PNG bytes are encoded by hand
// (zlib deflate + CRC32), so the program needs nothing but node itself.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- font --
// A 5x7 bitmap font, '#' = ink, '.' = blank. Uppercase, digits and the
// punctuation the page needs. All page text is set in capitals.
const GLYPHS: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '##..#', '#.#.#', '#..##', '#..##', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#..##', '#.#.#', '##..#', '#...#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '...#.', '..#..', '..#..', '..#..'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '.##..', '.#...'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  ';': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.#...'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  "'": ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'],
  '"': ['.#.#.', '.#.#.', '.#.#.', '.....', '.....', '.....', '.....'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '(': ['...##', '..#..', '.#...', '.#...', '.#...', '..#..', '...##'],
  ')': ['##...', '..#..', '...#.', '...#.', '...#.', '..#..', '##...'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  '%': ['##..#', '##.#.', '...#.', '..#..', '.#...', '#.##.', '#..##'],
  '&': ['.##..', '#..#.', '#..#.', '.#...', '#.#.#', '#..#.', '.##.#'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  $: ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  '*': ['.....', '.#.#.', '..#..', '#####', '..#..', '.#.#.', '.....'],
  '#': ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'],
  '\u2022': ['.....', '.....', '.###.', '.###.', '.###.', '.....', '.....'],
};

type RGB = [number, number, number];

// -------------------------------------------------------------- canvas --
class Canvas {
  readonly w: number;
  readonly h: number;
  readonly px: Buffer; // RGBA, row-major

  constructor(w: number, h: number, bg: RGB) {
    this.w = w;
    this.h = h;
    this.px = Buffer.alloc(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      this.px[i * 4] = bg[0];
      this.px[i * 4 + 1] = bg[1];
      this.px[i * 4 + 2] = bg[2];
      this.px[i * 4 + 3] = 255;
    }
  }

  set(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.px[i] = c[0];
    this.px[i + 1] = c[1];
    this.px[i + 2] = c[2];
  }

  fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
    }
  }

  rect(x: number, y: number, w: number, h: number, c: RGB, t = 1): void {
    this.fillRect(x, y, w, t, c);
    this.fillRect(x, y + h - t, w, t, c);
    this.fillRect(x, y, t, h, c);
    this.fillRect(x + w - t, y, t, h, c);
  }

  hline(x0: number, x1: number, y: number, c: RGB, t = 1): void {
    for (let t0 = 0; t0 < t; t0++) {
      for (let x = x0; x <= x1; x++) this.set(x, y + t0, c);
    }
  }

  vline(x: number, y0: number, y1: number, c: RGB, t = 1): void {
    for (let t0 = 0; t0 < t; t0++) {
      for (let y = y0; y <= y1; y++) this.set(x + t0, y, c);
    }
  }

  // Bresenham line, thickness t (square brush).
  line(x0: number, y0: number, x1: number, y1: number, c: RGB, t = 1): void {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    for (;;) {
      this.fillRect(x - Math.floor(t / 2), y - Math.floor(t / 2), t, t, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }

  // Quadratic bezier as a polyline.
  quad(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, c: RGB, t = 1): void {
    let px = x0;
    let py = y0;
    for (let i = 1; i <= 40; i++) {
      const s = i / 40;
      const x = Math.round((1 - s) * (1 - s) * x0 + 2 * (1 - s) * s * cx + s * s * x1);
      const y = Math.round((1 - s) * (1 - s) * y0 + 2 * (1 - s) * s * cy + s * s * y1);
      this.line(px, py, x, y, c, t);
      px = x;
      py = y;
    }
  }

  circle(cx: number, cy: number, r: number, c: RGB): void {
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        if (x * x + y * y <= r * r) this.set(cx + x, cy + y, c);
      }
    }
  }

  ring(cx: number, cy: number, r: number, c: RGB, t = 2): void {
    for (let a = 0; a < 360; a += 2) {
      const rad = (a * Math.PI) / 180;
      for (let k = 0; k < t; k++) {
        this.set(Math.round(cx + (r + k) * Math.cos(rad)), Math.round(cy + (r + k) * Math.sin(rad)), c);
      }
    }
  }

  // Filled polygon by scanline.
  poly(points: Array<[number, number]>, c: RGB): void {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of points) {
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const [x0, y0] = points[i];
        const [x1, y1] = points[(i + 1) % points.length];
        if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
          xs.push(Math.round(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0)));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = xs[k]; x <= xs[k + 1]; x++) this.set(x, y, c);
      }
    }
  }

  // Spiky explosion burst centred at (cx, cy).
  burst(cx: number, cy: number, r: number, c1: RGB, c2: RGB): void {
    const pts: Array<[number, number]> = [];
    const spikes = 12;
    for (let i = 0; i < spikes * 2; i++) {
      const a = (i * Math.PI) / spikes;
      const rr = i % 2 === 0 ? r : r * 0.45;
      pts.push([Math.round(cx + rr * Math.cos(a)), Math.round(cy + rr * Math.sin(a))]);
    }
    this.poly(pts, c1);
    this.circle(cx, cy, Math.max(3, Math.round(r * 0.35)), c2);
  }

  // ---- text ----
  textWidth(s: string, scale: number): number {
    return s.length * 6 * scale - scale;
  }

  drawGlyph(x: number, y: number, ch: string, scale: number, c: RGB): void {
    const g = GLYPHS[ch] ?? GLYPHS['?'];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (g[row][col] === '#') {
          this.fillRect(x + col * scale, y + row * scale, scale, scale, c);
        }
      }
    }
  }

  text(x: number, y: number, s: string, scale: number, c: RGB): void {
    const up = s.toUpperCase();
    for (let i = 0; i < up.length; i++) {
      this.drawGlyph(x + i * 6 * scale, y, up[i], scale, c);
    }
  }

  textCentered(cx: number, y: number, s: string, scale: number, c: RGB): void {
    this.text(cx - Math.floor(this.textWidth(s, scale) / 2), y, s, scale, c);
  }

  // Word-wrap to lines of at most maxW pixels; returns the lines.
  wrap(s: string, maxW: number, scale: number, maxLines?: number): string[] {
    const words = s.toUpperCase().split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      const cand = cur ? cur + ' ' + w : w;
      if (this.textWidth(cand, scale) <= maxW || !cur) {
        cur = cand;
      } else {
        lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    if (maxLines !== undefined && lines.length > maxLines) {
      return lines.slice(0, maxLines);
    }
    return lines;
  }
}

// -------------------------------------------------------------- PNG out --
const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  const crc = crc32(Buffer.concat([Buffer.from(type, 'ascii'), data]));
  out.writeUInt32BE(crc, 8 + data.length);
  return out;
}

function encodePNG(cv: Canvas): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(cv.w, 0);
  ihdr.writeUInt32BE(cv.h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(cv.h * (1 + cv.w * 4));
  for (let y = 0; y < cv.h; y++) {
    raw[y * (1 + cv.w * 4)] = 0; // filter: none
    cv.px.copy(raw, y * (1 + cv.w * 4) + 1, y * cv.w * 4, (y + 1) * cv.w * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// -------------------------------------------------------------- palette --
const PAPER: RGB = [247, 243, 234];
const PANEL: RGB = [255, 253, 246];
const INK: RGB = [22, 22, 22];
const RED: RGB = [176, 30, 30];
const NAVY: RGB = [31, 58, 95];
const NIGHT: RGB = [18, 32, 56];
const LAND: RGB = [46, 91, 52];
const LAND2: RGB = [58, 110, 64];
const SKYLINE: RGB = [214, 206, 188];
const GREY: RGB = [90, 86, 76];
const ORANGE: RGB = [232, 120, 32];
const YELLOW: RGB = [245, 196, 66];
const WHITE: RGB = [255, 255, 255];
const TEAL: RGB = [18, 110, 110];

// Deterministic pseudo-random: fixed seed, so stars never move.
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ---------------------------------------------------------------- icons --
// Each icon is drawn inside a 110x110 box at (ox, oy).
function iconBurst(cv: Canvas, ox: number, oy: number): void {
  cv.fillRect(ox, oy, 110, 110, [250, 238, 220]);
  cv.burst(ox + 55, oy + 58, 42, ORANGE, YELLOW);
  cv.burst(ox + 30, oy + 32, 16, RED, ORANGE);
  cv.burst(ox + 84, oy + 86, 13, RED, YELLOW);
}

function iconShield(cv: Canvas, ox: number, oy: number): void {
  cv.fillRect(ox, oy, 110, 110, [226, 236, 246]);
  cv.poly(
    [
      [ox + 55, oy + 14],
      [ox + 92, oy + 28],
      [ox + 92, oy + 58],
      [ox + 55, oy + 98],
      [ox + 18, oy + 58],
      [ox + 18, oy + 28],
    ],
    NAVY,
  );
  cv.poly(
    [
      [ox + 55, oy + 22],
      [ox + 84, oy + 33],
      [ox + 84, oy + 57],
      [ox + 55, oy + 90],
      [ox + 26, oy + 57],
      [ox + 26, oy + 33],
    ],
    WHITE,
  );
  cv.line(ox + 38, oy + 56, ox + 51, oy + 70, RED, 5);
  cv.line(ox + 51, oy + 70, ox + 74, oy + 40, RED, 5);
}

function iconGate(cv: Canvas, ox: number, oy: number): void {
  cv.fillRect(ox, oy, 110, 110, [238, 232, 220]);
  cv.fillRect(ox + 16, oy + 20, 8, 72, INK);
  cv.fillRect(ox + 86, oy + 20, 8, 72, INK);
  // striped barrier bar
  for (let i = 0; i < 7; i++) {
    cv.poly(
      [
        [ox + 22 + i * 10, oy + 44],
        [ox + 30 + i * 10, oy + 44],
        [ox + 22 + i * 10, oy + 62],
        [ox + 14 + i * 10, oy + 62],
      ],
      i % 2 === 0 ? RED : WHITE,
    );
  }
  cv.rect(ox + 14, oy + 44, 82, 18, INK, 2);
  cv.line(ox + 20, oy + 92, ox + 90, oy + 92, INK, 3);
}

function iconPlane(cv: Canvas, ox: number, oy: number): void {
  cv.fillRect(ox, oy, 110, 110, [226, 236, 246]);
  // fuselage + wings, nose to the right, banking down
  cv.poly(
    [
      [ox + 14, oy + 56],
      [ox + 78, oy + 34],
      [ox + 96, oy + 40],
      [ox + 80, oy + 52],
      [ox + 88, oy + 62],
      [ox + 60, oy + 66],
      [ox + 30, oy + 66],
    ],
    NAVY,
  );
  cv.poly(
    [
      [ox + 44, oy + 56],
      [ox + 58, oy + 78],
      [ox + 66, oy + 78],
      [ox + 58, oy + 58],
    ],
    NAVY,
  );
  cv.burst(ox + 88, oy + 88, 16, ORANGE, YELLOW);
  cv.line(ox + 84, oy + 82, ox + 96, oy + 94, RED, 3);
}

function iconCyclone(cv: Canvas, ox: number, oy: number): void {
  cv.fillRect(ox, oy, 110, 110, [226, 240, 238]);
  // spiral: three arcs of growing radius, each with a gap
  const cx = ox + 55;
  const cy = oy + 55;
  for (const r of [14, 26, 38]) {
    for (let a = 20; a < 320; a += 3) {
      const rad = (a * Math.PI) / 180;
      cv.fillRect(Math.round(cx + r * Math.cos(rad)) - 2, Math.round(cy + r * Math.sin(rad)) - 2, 4, 4, TEAL);
    }
  }
  cv.circle(cx, cy, 7, TEAL);
  // rain slashes
  cv.line(ox + 16, oy + 88, ox + 12, oy + 100, NAVY, 3);
  cv.line(ox + 94, oy + 88, ox + 98, oy + 100, NAVY, 3);
}

function iconChart(cv: Canvas, ox: number, oy: number): void {
  cv.fillRect(ox, oy, 110, 110, [250, 232, 228]);
  cv.line(ox + 18, oy + 18, ox + 18, oy + 92, INK, 3);
  cv.line(ox + 18, oy + 92, ox + 94, oy + 92, INK, 3);
  const pts: Array<[number, number]> = [
    [ox + 22, oy + 30],
    [ox + 38, oy + 44],
    [ox + 52, oy + 38],
    [ox + 68, oy + 62],
    [ox + 82, oy + 74],
    [ox + 92, oy + 88],
  ];
  for (let i = 0; i + 1 < pts.length; i++) {
    cv.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], RED, 4);
  }
  cv.poly(
    [
      [ox + 92, oy + 88],
      [ox + 80, oy + 84],
      [ox + 88, oy + 96],
    ],
    RED,
  );
  cv.circle(ox + 22, oy + 30, 4, RED);
}

// ----------------------------------------------------------- lead scene --
// Night sky over Poland and Ukraine: missile trails arc down to bursts.
function drawScene(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.fillRect(x, y, w, h, NIGHT);
  const rnd = lcg(21112026);
  for (let i = 0; i < 46; i++) {
    const sx = x + 8 + Math.floor(rnd() * (w - 16));
    const sy = y + 8 + Math.floor(rnd() * (h * 0.55));
    cv.circle(sx, sy, rnd() > 0.8 ? 2 : 1, [200, 210, 230]);
  }
  // pale moon
  cv.circle(x + w - 52, y + 34, 16, [232, 230, 214]);
  cv.circle(x + w - 58, y + 30, 13, NIGHT);
  // landmass along the bottom
  const base = y + h - 78;
  cv.poly(
    [
      [x, y + h],
      [x, base + 26],
      [x + 90, base + 6],
      [x + 190, base + 22],
      [x + 300, base - 2],
      [x + w, base + 18],
      [x + w, y + h],
    ],
    LAND,
  );
  cv.poly(
    [
      [x, y + h],
      [x, base + 40],
      [x + 120, base + 26],
      [x + 260, base + 34],
      [x + w, base + 40],
      [x + w, y + h],
    ],
    LAND2,
  );
  // city dots on the land
  for (const [dx, dy] of [
    [52, 44],
    [150, 26],
    [268, 40],
    [352, 22],
    [408, 48],
  ]) {
    cv.circle(x + dx, y + h - dy, 3, YELLOW);
  }
  // missile trails arcing down to the land
  cv.quad(x + 60, y + 16, x + 120, y + 120, x + 168, y + h - 96, [245, 196, 66], 3);
  cv.quad(x + 210, y + 8, x + 250, y + 130, x + 292, y + h - 108, [245, 196, 66], 3);
  cv.quad(x + 330, y + 22, x + 380, y + 120, x + 404, y + h - 88, [245, 196, 66], 3);
  // flame heads at the top of each trail
  cv.circle(x + 60, y + 16, 5, WHITE);
  cv.circle(x + 210, y + 8, 5, WHITE);
  cv.circle(x + 330, y + 22, 5, WHITE);
  // impacts
  cv.burst(x + 168, y + h - 96, 30, ORANGE, YELLOW);
  cv.burst(x + 292, y + h - 108, 36, ORANGE, YELLOW);
  cv.burst(x + 404, y + h - 88, 24, RED, ORANGE);
  // labels
  cv.text(x + 18, y + h - 66, 'POLAND', 2, WHITE);
  cv.text(x + 296, y + h - 34, 'UKRAINE', 2, WHITE);
  // BREAKING tag
  cv.fillRect(x + 12, y + 12, 118, 26, RED);
  cv.text(x + 20, y + 18, 'BREAKING', 2, WHITE);
}

// ------------------------------------------------------------ story card --
interface Story {
  kicker: string;
  headline: string;
  deck: string;
  icon: (cv: Canvas, ox: number, oy: number) => void;
}

function drawCard(cv: Canvas, x: number, y: number, w: number, h: number, s: Story): void {
  cv.fillRect(x, y, w, h, PANEL);
  cv.rect(x, y, w, h, SKYLINE, 1);
  s.icon(cv, x + 12, y + 16);
  const tx = x + 134;
  const tw = w - 134 - 14;
  cv.text(tx, y + 12, s.kicker, 2, RED);
  const headLines = cv.wrap(s.headline, tw, 3, 2);
  let cy = y + 32;
  for (const ln of headLines) {
    cv.text(tx, cy, ln, 3, INK);
    cy += 24;
  }
  const deckLines = cv.wrap(s.deck, tw, 2, 5);
  cy += 2;
  for (const ln of deckLines) {
    cv.text(tx, cy, ln, 2, [52, 50, 44]);
    cy += 15;
  }
}

// ----------------------------------------------------------------- page --
function buildPage(): Canvas {
  const cv = new Canvas(W, H, PAPER);
  // double outer border
  cv.rect(8, 8, W - 16, H - 16, INK, 3);
  cv.rect(15, 15, W - 30, H - 30, INK, 1);

  // ---- masthead ----
  cv.textCentered(512, 30, 'THE WORLD TODAY', 7, INK);
  cv.hline(60, 964, 106, INK, 2);
  cv.textCentered(512, 116, 'SATURDAY 21 NOVEMBER 2026', 3, RED);
  cv.hline(60, 964, 146, INK, 1);
  cv.hline(60, 964, 149, INK, 3);

  // ---- lead story ----
  const leadY = 162;
  const leadH = 288;
  drawScene(cv, 24, leadY, 446, leadH);
  const lx = 490;
  const lw = 1000 - lx;
  cv.text(lx, leadY + 8, 'WARSAW  -  NATO AIRSPACE', 2, RED);
  const leadHead = ['RUSSIAN', 'MISSILES CRASH', 'IN POLAND'];
  let hy = leadY + 36;
  for (const ln of leadHead) {
    cv.text(lx, hy, ln, 4, INK);
    hy += 30;
  }
  const deck =
    'TWO CRUISE MISSILES AND A SUSPECTED DRONE COME DOWN IN SOUTH-EAST POLAND DURING A HUGE OVERNIGHT ATTACK ON UKRAINE. WARSAW CALLS IT A DELIBERATE PROVOCATION; NATO CALLS IT A GRAVE VIOLATION OF ALLIED AIRSPACE.';
  const deckLines = cv.wrap(deck, lw, 2, 8);
  let dy = hy + 6;
  for (const ln of deckLines) {
    cv.text(lx, dy, ln, 2, [52, 50, 44]);
    dy += 16;
  }
  cv.text(lx, leadY + leadH - 22, 'REPORTED 21 NOVEMBER', 2, GREY);

  // ---- divider ----
  cv.hline(24, 1000, 464, INK, 2);

  // ---- six story cards ----
  const stories: Story[] = [
    {
      kicker: 'KYIV  -  OVERNIGHT',
      headline: 'UKRAINE UNDER FIRE',
      deck: 'RUSSIA LAUNCHES A MASSIVE OVERNIGHT ATTACK. EIGHT KILLED AND STRIKES HIT KYIV. FRANCE CALLS FOR A UN SECURITY COUNCIL MEETING.',
      icon: iconBurst,
    },
    {
      kicker: 'COPENHAGEN',
      headline: 'PLOT FOILED IN DENMARK',
      deck: 'DENMARK EXPELS A RUSSIAN DIPLOMAT OVER AN ALLEGED PLOT TO KILL US-UKRAINIAN RAPPER KYIVSTONER.',
      icon: iconShield,
    },
    {
      kicker: 'TALLINN',
      headline: 'ESTONIA SHUTS BORDER',
      deck: 'ESTONIA CLOSES ALL BORDER CROSSINGS WITH RUSSIA AFTER SUSPECTED ARSON SABOTAGE.',
      icon: iconGate,
    },
    {
      kicker: 'SIBERIA',
      headline: 'PLANE CRASH IN SIBERIA',
      deck: 'A RUSSIAN MILITARY TRANSPORT PLANE CRASHES IN SIBERIA, KILLING 19 PEOPLE ON BOARD.',
      icon: iconPlane,
    },
    {
      kicker: 'ODISHA, INDIA',
      headline: 'CYCLONE HITS INDIA',
      deck: 'CYCLONE AKVAN CROSSES THE ODISHA COAST, BRINGING STRONG WINDS AND HEAVY RAIN.',
      icon: iconCyclone,
    },
    {
      kicker: 'NEW YORK  -  MARKETS',
      headline: 'WALL STREET SLUMPS',
      deck: 'US STOCKS PLUNGE AS AI SHARES SELL OFF. THE S&P 500 ENTERS CORRECTION; NASDAQ FALLS 5.3%, NVIDIA DOWN ABOUT 14%.',
      icon: iconChart,
    },
  ];
  const cardW = 480;
  const cardH = 142;
  const gapX = 16;
  const gapY = 12;
  const gridY = 478;
  for (let i = 0; i < stories.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    drawCard(
      cv,
      24 + col * (cardW + gapX),
      gridY + row * (cardH + gapY),
      cardW,
      cardH,
      stories[i],
    );
  }

  // ---- bottom strip: AI chips + footer ----
  const stripY = 936;
  cv.fillRect(24, stripY, 976, 44, NAVY);
  // small chip pictogram inside the strip
  cv.fillRect(40, stripY + 8, 28, 28, YELLOW);
  cv.fillRect(49, stripY + 17, 10, 10, NAVY);
  for (const px of [46, 56]) {
    cv.fillRect(px, stripY + 2, 4, 6, WHITE);
    cv.fillRect(px, stripY + 36, 4, 6, WHITE);
  }
  for (const py of [stripY + 14, stripY + 24]) {
    cv.fillRect(34, py, 6, 4, WHITE);
    cv.fillRect(68, py, 6, 4, WHITE);
  }
  cv.text(88, stripY + 15, 'ALSO TODAY: US APPROVES NEARLY 880,000 AI CHIP EXPORTS TO CHINA', 2, WHITE);
  cv.textCentered(512, 992, 'THE WORLD TODAY  -  SATURDAY 21 NOVEMBER 2026', 2, GREY);

  return cv;
}

// ------------------------------------------------------------------ main --
function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  mkdirSync(outDir, { recursive: true });
  const png = encodePNG(buildPage());
  writeFileSync(join(outDir, 'entry.png'), png);
}

main();
