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

export const POWERUP_TYPE = {
  BOMB: 'BOMB',   // +1 bomba simultânea
  FIRE: 'FIRE',   // +1 alcance de chama
  SPEED: 'SPEED'  // +velocidade (menor cooldown de movimento)
};

export const ROOM_STATUS = {
  LOBBY: 'LOBBY',
  PLAYING: 'PLAYING',
  FINISHED: 'FINISHED'
};

export const SPAWN_POSITIONS = [
  { x: 1, y: 1 },
  { x: 15, y: 1 },
  { x: 1, y: 11 },
  { x: 15, y: 11 }
];

export function getSpawnPositions(width = 17, height = 13) {
  return [
    { x: 1, y: 1 },
    { x: width - 2, y: 1 },
    { x: 1, y: height - 2 },
    { x: width - 2, y: height - 2 }
  ];
}

export const PLAYER_COLORS = [
  '#e74c3c', // Vermelho (P1)
  '#3498db', // Azul (P2)
  '#2ecc71', // Verde (P3)
  '#f39c12'  // Amarelo (P4)
];
