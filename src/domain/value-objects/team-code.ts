import { randomInt } from 'node:crypto';

const PREFIX_LENGTH = 4;
const SUFFIX_LENGTH = 4;

/** Sin I/L/O: solo se usa para rellenar el prefijo cuando el nombre no
 * alcanza letras (ej. un nombre en emojis) — un carácter random ahí no
 * debería depender de distinguir esos entre sí. */
const FALLBACK_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';

// Rango Unicode de los diacríticos combinantes (tildes, virgulillas, etc.)
// que quedan sueltos tras normalize('NFD') — ej. "é" -> "e" + este rango.
const COMBINING_DIACRITICS_START = 0x0300;
const COMBINING_DIACRITICS_END = 0x036f;

function lettersFromName(name: string): string {
  const withoutDiacritics = Array.from(name.normalize('NFD'))
    .filter((char) => {
      const codePoint = char.codePointAt(0) ?? 0;
      return codePoint < COMBINING_DIACRITICS_START || codePoint > COMBINING_DIACRITICS_END;
    })
    .join('');
  return withoutDiacritics.toUpperCase().replace(/[^A-Z]/g, ''); // solo letras — espacios, números, emojis fuera
}

function buildPrefix(teamName: string): string {
  const letters = lettersFromName(teamName);
  if (letters.length >= PREFIX_LENGTH) return letters.slice(0, PREFIX_LENGTH);

  let prefix = letters;
  while (prefix.length < PREFIX_LENGTH) {
    prefix += FALLBACK_LETTERS[randomInt(FALLBACK_LETTERS.length)];
  }
  return prefix;
}

function randomDigits(length: number): string {
  let digits = '';
  for (let i = 0; i < length; i++) {
    digits += randomInt(10).toString();
  }
  return digits;
}

/**
 * TeamCode: identificador de reingreso de un equipo, visible SOLO para ese
 * equipo (se muestra una vez, al registrarse) y para el profesor — nunca
 * para los demás equipos. Reemplaza el reingreso por nombre (ver
 * RegisterTeamUseCase): cualquiera podía escribir el nombre exacto de un
 * equipo rival y entrar como si fuera ese equipo.
 *
 * Formato: 4 letras del nombre del equipo + 4 dígitos aleatorios (ej.
 * "Equipo 1" -> "EQUI4827"). Empezar con las letras del propio nombre lo
 * hace mucho más fácil de recordar/escribir que un código 100% aleatorio —
 * los dígitos siguen garantizando unicidad (verificada con reintento en
 * RegisterTeamUseCase, ver findByCode).
 */
export class TeamCode {
  private readonly value: string;

  private constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('TeamCode no puede estar vacío');
    }
    this.value = value.trim().toUpperCase();
  }

  static generate(teamName: string): TeamCode {
    return new TeamCode(buildPrefix(teamName) + randomDigits(SUFFIX_LENGTH));
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
