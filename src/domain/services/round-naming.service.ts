/**
 * Nombre convencional de una ronda según cuántos matches tiene — misma
 * convención que `roundNameForMatchCount` en el frontend (tournament-frontend
 * /src/utils/roundNaming.ts), duplicada acá porque son repos/runtimes
 * separados sin paquete compartido. Si se cambia una, hay que cambiar la otra.
 */
export class RoundNamingService {
  static nameForMatchCount(matchCount: number): string {
    switch (matchCount) {
      case 1:
        return 'Final';
      case 2:
        return 'Semifinal';
      case 4:
        return 'Cuartos de Final';
      case 8:
        return 'Octavos de Final';
      case 16:
        return 'Dieciseisavos de Final';
      default:
        return `Ronda de ${matchCount * 2}`;
    }
  }
}
