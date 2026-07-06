/**
 * Tokens de DI: las interfaces TS (TeamRepository, TournamentRepository...)
 * no existen en tiempo de ejecución, así que NestJS no puede usarlas como
 * clave de inyección. Estos Symbols son la clave real; el módulo los mapea
 * a la implementación concreta (Sqlite en producción, InMemory en tests).
 */
export const TEAM_REPOSITORY = Symbol('TeamRepository');
export const TOURNAMENT_REPOSITORY = Symbol('TournamentRepository');
export const BUSINESS_CASE_REPOSITORY = Symbol('BusinessCaseRepository');
export const QUALIFYING_ROUND_REPOSITORY = Symbol('QualifyingRoundRepository');
export const TOURNAMENT_DATABASE = Symbol('TournamentDatabase');
