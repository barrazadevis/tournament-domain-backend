import { CodeRunner } from '../ports/code-runner';
import { BusinessCaseTestCase } from '../../domain/entities/business-case';
import { ExecutionResult, TestCaseExecutionResult } from '../../domain/entities/submission';

const PISTON_LANGUAGE_BY_TOURNAMENT_LANGUAGE: Record<string, string> = {
  PYTHON: 'python',
};

/**
 * Corre el código contra cada test case del caso y arma el ExecutionResult.
 * Compartido entre TestCodeUseCase (dry-run) y RunSubmissionCodeUseCase
 * (anota la submission oficial) — misma lógica de comparación, distinto
 * destino del resultado.
 */
export async function runCodeAgainstTestCases(
  codeRunner: CodeRunner,
  tournamentLanguage: string,
  code: string,
  testCases: ReadonlyArray<BusinessCaseTestCase>,
): Promise<ExecutionResult> {
  const pistonLanguage = PISTON_LANGUAGE_BY_TOURNAMENT_LANGUAGE[tournamentLanguage];
  const testResults: TestCaseExecutionResult[] = [];
  let stderr: string | null = null;
  let hadTimeout = false;

  for (const testCase of testCases) {
    const result = await codeRunner.run({ language: pistonLanguage, code, stdin: testCase.input });
    if (result.timedOut) {
      hadTimeout = true;
      break;
    }
    if (result.stderr) stderr = result.stderr;
    testResults.push({
      input: testCase.input,
      expectedOutput: testCase.expectedOutput,
      actualOutput: result.stdout,
      passed: result.stdout.trim() === testCase.expectedOutput.trim(),
    });
  }

  return {
    status: hadTimeout ? 'ERROR' : 'RAN',
    testResults,
    stderr,
  };
}
