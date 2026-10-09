// The brand in one place. Everything is square blocks of ink on paper, on a
// dot grid; colour only shows up as light, when something happens. The page
// (CSS, theme colour and favicon, via vite.config.js), the shaders, the share
// cards, the font and the brand kit scripts all read from here.

/** Paper and ink. `dots` is how dark the grid prints in still images. */
export const THEMES = {
  light: { bg: '#f0f0eb', fg: '#0e0e0e', dots: 0.09 },
  dark: { bg: '#0c0c0c', fg: '#ebebe4', dots: 0.12 },
};

/** The light: red at the leading edge of a ring, violet at the trailing edge. */
export const SPECTRUM = ['#ff453a', '#ff9429', '#ffdb33', '#4cdb6b', '#33ccf2', '#406bff', '#9e52ff'];
export const COLOURS = ['RED', 'ORANGE', 'YELLOW', 'GREEN', 'CYAN', 'BLUE', 'VIOLET'];

/** The dot grid: 2px dots, 16px apart. */
export const GRID = { step: 16, dot: 2 };

/** The pixel font as a file (scripts/font.mjs), served from /fonts/. */
export const FONT = {
  family: 'JP Pixel',
  files: { regular: 'jp-pixel-regular', bold: 'jp-pixel-bold' },
};

/** '#rrggbb' -> [r, g, b] in 0-255. */
export const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
/** '#rrggbb' -> [r, g, b] in 0-1, for shaders. */
export const unit = (hex) => rgb(hex).map((c) => c / 255);
