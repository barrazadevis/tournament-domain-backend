import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * TournamentDatabase: única responsabilidad es abrir la conexión y aplicar
 * el esquema. Los repositorios reciben esta instancia por constructor
 * (Dependency Injection manual) — nadie más gestiona el ciclo de vida de
 * la conexión.
 *
 * Nota: node:sqlite es síncrono (a diferencia de un driver como `pg` para
 * Postgres, que sería asíncrono). Los repositorios exponen una API async
 * (Promise) igual, para que migrar a Postgres en Render más adelante no
 * cambie ningún contrato de los puertos — solo esta clase y los adapters.
 */
export class TournamentDatabase {
  readonly connection: DatabaseSync;

  constructor(filePath: string) {
    this.connection = new DatabaseSync(filePath);
    this.connection.exec('PRAGMA foreign_keys = ON;');
    this.applySchema();
  }

  private applySchema(): void {
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    this.connection.exec(schema);
    this.applyMigrations();
  }

  /**
   * `CREATE TABLE IF NOT EXISTS` no agrega columnas a una tabla que ya
   * existía de una versión anterior del esquema — por eso las columnas
   * nuevas se agregan aquí con ALTER TABLE, ignorando el error si la
   * columna ya existe (DB recién creada, donde schema.sql ya la trae).
   */
  private applyMigrations(): void {
    try {
      this.connection.exec('ALTER TABLE teams ADD COLUMN logo TEXT');
    } catch {
      // La columna ya existe — no hay nada que migrar.
    }
  }

  close(): void {
    this.connection.close();
  }
}
