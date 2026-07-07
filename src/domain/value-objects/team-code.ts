import { randomInt } from 'node:crypto';

/**
 * Charset sin 0/O/1/I/L: un código que un estudiante va a escribir a mano
 * o leer en voz alta en un salón de clase no debería depender de distinguir
 * esos caracteres entre sí.
 */
const CODE_CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

/**
 * TeamCode: identificador de reingreso de un equipo, visible SOLO para ese
 * equipo (se muestra una vez, al registrarse) y para el profesor — nunca
 * para los demás equipos. Reemplaza el reingreso por nombre (ver
 * RegisterTeamUseCase): cualquiera podía escribir el nombre exacto de un
 * equipo rival y entrar como si fuera ese equipo.
 */
export class TeamCode {
  private readonly value: string;

  private constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('TeamCode no puede estar vacío');
    }
    this.value = value.trim().toUpperCase();
  }

  static generate(): TeamCode {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_CHARSET[randomInt(CODE_CHARSET.length)];
    }
    return new TeamCode(code);
  }

  static fromString(value: string): TeamCode {
    return new TeamCode(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: TeamCode): boolean {
    return this.value === other.value;
  }
}
