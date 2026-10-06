import { TILE_TYPE } from './Constants.js';

export class MapGenerator {
  /**
   * Gera a matriz da arena do Bomberman clássico (13x11).
   * @param {number} width Largura da arena (padrão 13)
   * @param {number} height Altura da arena (padrão 11)
   * @param {number} destructibleDensity Probabilidade de gerar tijolo em células válidas (0.0 a 1.0)
   * @param {function} randomFn Gerador pseudo-aleatório opcional para testes reprodutíveis
   * @returns {number[][]} Matriz 2D onde cada valor é TILE_TYPE
   */
  static generate(width = 13, height = 11, destructibleDensity = 0.70, randomFn = Math.random) {
    const map = [];

    // Conjunto de coordenadas reservadas para spawn seguro (cantos e adjacências)
    const reservedTiles = new Set([
      // Canto Superior Esquerdo (P1)
      '1,1', '1,2', '2,1',
      // Canto Superior Direito (P2)
      `${width - 2},1`, `${width - 3},1`, `${width - 2},2`,
      // Canto Inferior Esquerdo (P3)
      `1,${height - 2}`, `1,${height - 3}`, `2,${height - 2}`,
      // Canto Inferior Direito (P4)
      `${width - 2},${height - 2}`, `${width - 3},${height - 2}`, `${width - 2},${height - 3}`
    ]);

    for (let y = 0; y < height; y++) {
      const row = [];
      for (let x = 0; x < width; x++) {
        // Bordas indestrutíveis
        if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
          row.push(TILE_TYPE.INDESTRUCTIBLE);
        }
        // Pilares internos fixos clássicos
        else if (x % 2 === 0 && y % 2 === 0) {
          row.push(TILE_TYPE.INDESTRUCTIBLE);
        }
        // Células de spawn dos jogadores permanecem livres
        else if (reservedTiles.has(`${x},${y}`)) {
          row.push(TILE_TYPE.EMPTY);
        }
        // Demais células podem receber blocos destrutíveis
        else {
          if (randomFn() < destructibleDensity) {
            row.push(TILE_TYPE.DESTRUCTIBLE);
          } else {
            row.push(TILE_TYPE.EMPTY);
          }
        }
      }
      map.push(row);
    }

    return map;
  }
}
