import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { PasswordHasher } from '../../application/ports/password-hasher';

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

/**
 * scrypt viene en el core de Node (a diferencia de bcrypt, que es un módulo
 * nativo) — mismo motivo por el que este backend usa `node:sqlite` en vez
 * de Prisma/TypeORM: el entorno original no tenía salida de red para
 * binarios nativos. Formato almacenado: "<saltHex>:<hashHex>".
 */
export class ScryptPasswordHasher implements PasswordHasher {
  async hash(plain: string): Promise<string> {
    const salt = randomBytes(16);
    const derivedKey = (await scryptAsync(plain, salt, KEY_LENGTH)) as Buffer;
    return `${salt.toString('hex')}:${derivedKey.toString('hex')}`;
  }

  async verify(plain: string, stored: string): Promise<boolean> {
    const [saltHex, hashHex] = stored.split(':');
    if (!saltHex || !hashHex) return false;

    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const actual = (await scryptAsync(plain, salt, expected.length)) as Buffer;

    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  }
}
