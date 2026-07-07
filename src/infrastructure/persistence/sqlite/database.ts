import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TeamCode } from '../../../domain/value-objects/team-code';

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
    try {
      this.connection.exec('ALTER TABLE teams ADD COLUMN code TEXT');
    } catch {
      // La columna ya existe — no hay nada que migrar.
    }
    try {
      this.connection.exec("ALTER TABLE tournaments ADD COLUMN pending_case_ids TEXT NOT NULL DEFAULT '[]'");
    } catch {
      // La columna ya existe — no hay nada que migrar.
    }
    this.backfillMissingTeamCodes();
  }

  /**
   * Equipos registrados antes de que existiera `code` (columna recién
   * agregada arriba) se quedan con `code IS NULL` tras el ALTER TABLE — sin
   * esto, quedarían para siempre sin forma de reingresar por código. Corre
   * en cada boot pero no hace nada una vez que ninguna fila tiene el
   * código en null (la condición depende de los datos, no de si el ALTER
   * TABLE de arriba lanzó o no).
   */
  private backfillMissingTeamCodes(): void {
    const rows = this.connection.prepare('SELECT id, name FROM teams WHERE code IS NULL').all() as unknown as Array<{
      id: string;
      name: string;
    }>;

    for (const row of rows) {
      let code: string;
      do {
        code = TeamCode.generate(row.name).toString();
      } while (this.connection.prepare('SELECT 1 FROM teams WHERE code = ?').get(code));
      this.connection.prepare('UPDATE teams SET code = ? WHERE id = ?').run(code, row.id);
    }
  }

  close(): void {
    this.connection.close();
  }
}
