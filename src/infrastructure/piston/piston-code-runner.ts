import { CodeRunInput, CodeRunner, CodeRunResult } from '../../application/ports/code-runner';

const DEFAULT_PISTON_URL = 'https://emkc.org/api/v2/piston';
const REQUEST_TIMEOUT_MS = 10_000;

interface PistonRuntime {
  language: string;
  version: string;
  aliases: string[];
}

interface PistonExecuteResponse {
  run: { stdout: string; stderr: string; code: number | null; signal: string | null };
  compile?: { stdout: string; stderr: string; code: number | null; signal: string | null };
}

/**
 * Adaptador de CodeRunner sobre Piston (https://github.com/engineer-man/piston)
 * — motor de ejecución de código sandboxed (Isolate). Usa la API pública por
 * default; para uso en clase real, self-hostear vía Docker y apuntar
 * PISTON_URL ahí — nada más cambia (mismo contrato).
 *
 * IMPORTANTE: PISTON_URL debe incluir el prefijo de versión de API, ej.
 * `http://localhost:2000/api/v2` para un self-host — NO solo el host. El
 * default público ya lo trae embebido (`.../api/v2/piston`, una
 * particularidad de cómo emkc.org expone el path, distinta de un self-host
 * estándar que expone directo en `/api/v2`).
 *
 * La versión del runtime se resuelve una vez desde /runtimes (relativo a
 * PISTON_URL) y se cachea en memoria del proceso, en vez de hardcodearla —
 * Piston rechaza pares lenguaje/versión que no coincidan exactamente con lo
 * que tiene instalado, y eso varía entre instancias (pública vs self-hosted).
 */
export class PistonCodeRunner implements CodeRunner {
  private readonly baseUrl: string;
  private runtimeVersionCache = new Map<string, string>();

  constructor(baseUrl: string = process.env.PISTON_URL ?? DEFAULT_PISTON_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async run(input: CodeRunInput): Promise<CodeRunResult> {
    try {
      const version = await this.resolveVersion(input.language);
      const response = await fetch(`${this.baseUrl}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: input.language,
          version,
          files: [{ content: input.code }],
          stdin: input.stdin,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        return { stdout: '', stderr: `Piston respondió ${response.status}`, exitCode: null, timedOut: true };
      }

      const body = (await response.json()) as PistonExecuteResponse;
      return {
        stdout: body.run.stdout,
        stderr: body.run.stderr,
        exitCode: body.run.code,
        timedOut: false,
      };
    } catch {
      // Timeout (AbortSignal), DNS, conexión rechazada, etc. — todo se
      // normaliza igual, el caso de uso solo necesita saber "no se pudo".
      return { stdout: '', stderr: 'No se pudo contactar el motor de ejecución', exitCode: null, timedOut: true };
    }
  }

  private async resolveVersion(language: string): Promise<string> {
    const cached = this.runtimeVersionCache.get(language);
    if (cached) return cached;

    const response = await fetch(`${this.baseUrl}/runtimes`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    const runtimes = (await response.json()) as PistonRuntime[];
    const match = runtimes.find((r) => r.language === language || r.aliases.includes(language));
    if (!match) {
      throw new Error(`Piston no tiene instalado el lenguaje "${language}"`);
    }
    this.runtimeVersionCache.set(language, match.version);
    return match.version;
  }
}
