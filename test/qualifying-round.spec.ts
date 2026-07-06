import { EntityId } from '../src/domain/value-objects/entity-id';
import { Team } from '../src/domain/entities/team';
import { Submission } from '../src/domain/entities/submission';
import { BusinessCase, RequiredStructureType } from '../src/domain/entities/business-case';
import {
  QualifyingRound,
  QualifyingRoundNotFinishedError,
  DuplicateSubmissionError,
} from '../src/domain/entities/qualifying-round';

function buildTeams(count: number): Team[] {
  return Array.from({ length: count }, (_, i) =>
    new Team(EntityId.generate(), `Equipo ${i + 1}`, [{ fullName: `Estudiante ${i + 1}` }]),
  );
}

function buildCase(): BusinessCase {
  return new BusinessCase(
    EntityId.generate(),
    'Caso clasificatorio',
    'Diseñar el ciclo para el bono de vendedores',
    RequiredStructureType.SINGLE_STRUCTURE,
  );
}

describe('QualifyingRound', () => {
  it('rechaza crearse si el número de equipos ya es potencia de 2', () => {
    expect(() => new QualifyingRound(EntityId.generate(), buildTeams(8), buildCase(), 300)).toThrow(
      'ya es potencia de 2',
    );
  });

  it('calcula correctamente cuántos deben avanzar (9 equipos -> 8)', () => {
    const round = new QualifyingRound(EntityId.generate(), buildTeams(9), buildCase(), 300);
    expect(round.getTargetQualifierCount()).toBe(8);
  });

  it('calcula correctamente cuántos deben avanzar (7 equipos -> 4)', () => {
    const round = new QualifyingRound(EntityId.generate(), buildTeams(7), buildCase(), 300);
    expect(round.getTargetQualifierCount()).toBe(4);
  });

  it('no permite que un mismo equipo envíe dos veces', () => {
    const teams = buildTeams(9);
    const round = new QualifyingRound(EntityId.generate(), teams, buildCase(), 300);
    const now = new Date();

    round.submit(new Submission(EntityId.generate(), teams[0].getId(), 'Intento 1', now));
    expect(() =>
      round.submit(new Submission(EntityId.generate(), teams[0].getId(), 'Intento 2', now)),
    ).toThrow(DuplicateSubmissionError);
  });

  it('lanza error si se piden los clasificados antes de juzgar a todos', () => {
    const teams = buildTeams(9);
    const round = new QualifyingRound(EntityId.generate(), teams, buildCase(), 300);
    const now = new Date();
    teams.forEach((t) => round.submit(new Submission(EntityId.generate(), t.getId(), 'Intento', now)));
    round.approveSubmission(teams[0].getId(), now);
    // Faltan 8 por juzgar todavía.

    expect(() => round.computeQualifiers()).toThrow(QualifyingRoundNotFinishedError);
  });

  it('los 8 más rápidos con submission aprobada avanzan de entre 9 equipos', () => {
    const teams = buildTeams(9);
    const round = new QualifyingRound(EntityId.generate(), teams, buildCase(), 300);

    const baseTime = new Date('2026-01-01T10:00:00Z').getTime();
    // team[8] es el más lento de todos (será el eliminado).
    teams.forEach((team, index) => {
      const submittedAt = new Date(baseTime + index * 1000); // cada uno 1s más tarde
      round.submit(new Submission(EntityId.generate(), team.getId(), `Intento ${index}`, submittedAt));
    });

    const now = new Date();
    teams.forEach((team) => round.approveSubmission(team.getId(), now));

    const qualifiers = round.computeQualifiers();
    expect(qualifiers).toHaveLength(8);
    // El equipo más lento (índice 8, el último) no debe estar entre los clasificados.
    const slowestTeamId = teams[8].getId();
    expect(qualifiers.some((id) => id.equals(slowestTeamId))).toBe(false);
    // El más rápido (índice 0) sí debe estar.
    expect(qualifiers.some((id) => id.equals(teams[0].getId()))).toBe(true);
  });

  it('una submission rechazada no cuenta aunque haya sido rápida', () => {
    const teams = buildTeams(9);
    const round = new QualifyingRound(EntityId.generate(), teams, buildCase(), 300);
    const baseTime = new Date('2026-01-01T10:00:00Z').getTime();

    teams.forEach((team, index) => {
      const submittedAt = new Date(baseTime + index * 1000);
      round.submit(new Submission(EntityId.generate(), team.getId(), `Intento ${index}`, submittedAt));
    });

    const now = new Date();
    // El más rápido (índice 0) entrega algo incorrecto -> rechazado.
    round.rejectSubmission(teams[0].getId(), now);
    for (let i = 1; i < teams.length; i++) {
      round.approveSubmission(teams[i].getId(), now);
    }

    const qualifiers = round.computeQualifiers();
    expect(qualifiers).toHaveLength(8);
    expect(qualifiers.some((id) => id.equals(teams[0].getId()))).toBe(false);
  });
});
