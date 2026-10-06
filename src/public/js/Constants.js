export const TILE_SIZE = 48;
export const GRID_WIDTH = 17;
export const GRID_HEIGHT = 13;

export const TILE_TYPE = {
  EMPTY: 0,
  INDESTRUCTIBLE: 1,
  DESTRUCTIBLE: 2
};

export const DIRECTION = {
  UP: 'UP',
  DOWN: 'DOWN',
  LEFT: 'LEFT',
  RIGHT: 'RIGHT'
};

export const DIR_OFFSETS = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 }
};

export const PLAYER_COLORS = [
  '#e74c3c', // P1 Vermelho
  '#3498db', // P2 Azul
  '#2ecc71', // P3 Verde
  '#f39c12'  // P4 Amarelo
];

export const EMOTE_ICONS = {
  gg: '😎',
  bomb: '💣',
  cry: '😭',
  fire: '🔥'
};
