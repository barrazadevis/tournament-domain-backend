export interface CodeRunInput {
  language: string;
  code: string;
  stdin: string;
}

export interface CodeRunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  /** true si el motor de ejecución no respondió a tiempo o no estaba disponible — distinto de que el código haya fallado con error. */
  timedOut: boolean;
}

/**
 * Puerto para ejecutar código de estudiantes en un sandbox externo (Piston).
 * Nunca lanza: errores de red/timeout se normalizan en el resultado
 * (`timedOut: true`, salidas vacías) para que los casos de uso no necesiten
 * try/catch de infraestructura — solo revisan el shape del resultado.
 */
export interface CodeRunner {
  run(input: CodeRunInput): Promise<CodeRunResult>;
}
