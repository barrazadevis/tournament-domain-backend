/**
 * PowerOfTwoMath: funciones puras sobre potencias de 2.
 *
 * Separado como utilidad propia (DRY) porque tanto QualifyingRoundService
 * como BracketGenerationService necesitan saber "¿a qué número exacto de
 * equipos debo llegar?".
 */
export class PowerOfTwoMath {
  static isPowerOfTwo(n: number): boolean {
    return n >= 1 && (n & (n - 1)) === 0;
  }

  /** La potencia de 2 más cercana hacia abajo (ej. 9 -> 8, 7 -> 4, 16 -> 16). */
  static largestPowerOfTwoLessOrEqual(n: number): number {
    if (n < 1) {
      throw new Error('Se necesita al menos 1 equipo');
    }
    return 2 ** Math.floor(Math.log2(n));
  }
}
