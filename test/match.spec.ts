import { EntityId } from '../src/domain/value-objects/entity-id';
import { Match } from '../src/domain/entities/match';
import { Submission } from '../src/domain/entities/submission';
import { BusinessCase, RequiredStructureType } from '../src/domain/entities/business-case';
import { MatchStatus } from '../src/domain/services/match-state-machine';

function buildMatch(timerSeconds = 300): {
  match: Match;
  teamAId: EntityId;
  teamBId: EntityId;
} {
  const teamAId = EntityId.generate();
  const teamBId = EntityId.generate();
  const businessCase = new BusinessCase(
    EntityId.generate(),
    'Cálculo de bono de vendedores',
    'Diseñar el ciclo para calcular el bono de 20 vendedores según sus ventas',
    RequiredStructureType.SINGLE_STRUCTURE,
  );
  const match = new Match(
    EntityId.generate(),
    'Cuartos de Final',
    teamAId,
    teamBId,
    businessCase,
    timerSeconds,
  );
  return { match, teamAId, teamBId };
}

describe('Match', () => {
  describe('creación', () => {
    it('no permite que un equipo se enfrente a sí mismo', () => {
      const teamId = EntityId.generate();
      const businessCase = new BusinessCase(
        EntityId.generate(),
        'Caso',
        'Descripción',
        RequiredStructureType.SINGLE_STRUCTURE,
      );
      expect(
        () => new Match(EntityId.generate(), 'Cuartos', teamId, teamId, businessCase, 300),
      ).toThrow('Un equipo no puede enfrentarse a sí mismo');
    });

    it('no permite duración de timer negativa o cero', () => {
      const businessCase = new BusinessCase(
        EntityId.generate(),
        'Caso',
        'Descripción',
        RequiredStructureType.SINGLE_STRUCTURE,
      );
      expect(
        () =>
          new Match(
            EntityId.generate(),
            'Cuartos',
            EntityId.generate(),
            EntityId.generate(),
            businessCase,
            0,
          ),
      ).toThrow('La duración del timer debe ser positiva');
    });
  });

  describe('camino feliz: envío y aprobación', () => {
    it('resuelve el match con ganador cuando el juez aprueba la submission', () => {
      const { match, teamAId } = buildMatch();
      const now = new Date();

      match.start(now);
      expect(match.getStatus()).toBe(MatchStatus.ACTIVE);

      const submission = new Submission(
        EntityId.generate(),
        teamAId,
        'Estructura: Para. Pseudocódigo: ...',
        now,
      );
      match.submitSolution(submission);
      expect(match.getStatus()).toBe(MatchStatus.AWAITING_JUDGMENT);

      match.approveCurrentSubmission(now);
      expect(match.getStatus()).toBe(MatchStatus.RESOLVED);
      expect(match.getWinnerId()?.equals(teamAId)).toBe(true);
      expect(match.getResolution()).toBe('WINNER');
    });
  });

  describe('camino de rechazo: rival obtiene su oportunidad', () => {
    it('vuelve a ACTIVE tras un rechazo y permite al rival enviar', () => {
      const { match, teamAId, teamBId } = buildMatch();
      const now = new Date();
      match.start(now);

      const badSubmission = new Submission(EntityId.generate(), teamAId, 'Respuesta con error', now);
      match.submitSolution(badSubmission);
      match.rejectCurrentSubmission(now);

      expect(match.getStatus()).toBe(MatchStatus.ACTIVE);
      expect(match.getResolution()).toBeNull();

      const goodSubmission = new Submission(
        EntityId.generate(),
        teamBId,
        'Respuesta corregida por el rival',
        now,
      );
      match.submitSolution(goodSubmission);
      match.approveCurrentSubmission(now);

      expect(match.getWinnerId()?.equals(teamBId)).toBe(true);
    });

    it('no permite que un equipo ya descalificado vuelva a intentar', () => {
      const { match, teamAId } = buildMatch();
      const now = new Date();
      match.start(now);

      match.submitSolution(new Submission(EntityId.generate(), teamAId, 'Intento 1', now));
      match.rejectCurrentSubmission(now);

      expect(() =>
        match.submitSolution(new Submission(EntityId.generate(), teamAId, 'Intento 2', now)),
      ).toThrow('descalificado');
    });

    it('resuelve sin ganador si ambos equipos son rechazados', () => {
      const { match, teamAId, teamBId } = buildMatch();
      const now = new Date();
      match.start(now);

      match.submitSolution(new Submission(EntityId.generate(), teamAId, 'Intento A', now));
      match.rejectCurrentSubmission(now);

      match.submitSolution(new Submission(EntityId.generate(), teamBId, 'Intento B', now));
      match.rejectCurrentSubmission(now);

      expect(match.getStatus()).toBe(MatchStatus.RESOLVED);
      expect(match.getResolution()).toBe('NO_WINNER');
      expect(match.getWinnerId()).toBeNull();
    });
  });

  describe('protección de invariantes', () => {
    it('rechaza submission de un equipo que no participa en el match', () => {
      const { match } = buildMatch();
      const now = new Date();
      match.start(now);

      const outsiderId = EntityId.generate();
      expect(() =>
        match.submitSolution(new Submission(EntityId.generate(), outsiderId, 'Intruso', now)),
      ).toThrow('no participa en el match');
    });

    it('no permite enviar solución si el match no está ACTIVE', () => {
      const { match, teamAId } = buildMatch();
      const now = new Date();
      // Match sigue en PENDING, nunca se llamó start()

      expect(() =>
        match.submitSolution(new Submission(EntityId.generate(), teamAId, 'Muy temprano', now)),
      ).toThrow('Transición inválida');
    });

    it('no permite aprobar dos veces el mismo match', () => {
      const { match, teamAId } = buildMatch();
      const now = new Date();
      match.start(now);
      match.submitSolution(new Submission(EntityId.generate(), teamAId, 'Solución', now));
      match.approveCurrentSubmission(now);

      expect(() => match.approveCurrentSubmission(now)).toThrow();
    });
  });

  describe('expiración del timer', () => {
    it('resuelve sin ganador si el timer expira sin submissions', () => {
      const { match } = buildMatch();
      const now = new Date();
      match.start(now);

      match.expireTimer();

      expect(match.getStatus()).toBe(MatchStatus.RESOLVED);
      expect(match.getResolution()).toBe('NO_WINNER');
    });

    it('no afecta un match que ya está bajo juicio', () => {
      const { match, teamAId } = buildMatch();
      const now = new Date();
      match.start(now);
      match.submitSolution(new Submission(EntityId.generate(), teamAId, 'Solución', now));

      match.expireTimer(); // no-op: ya está AWAITING_JUDGMENT

      expect(match.getStatus()).toBe(MatchStatus.AWAITING_JUDGMENT);
    });

    it('hasElapsedTimerDuration detecta correctamente el vencimiento', () => {
      const { match } = buildMatch(60); // 60 segundos
      const start = new Date('2026-01-01T10:00:00Z');
      match.start(start);

      const before = new Date('2026-01-01T10:00:59Z');
      const after = new Date('2026-01-01T10:01:01Z');

      expect(match.hasElapsedTimerDuration(before)).toBe(false);
      expect(match.hasElapsedTimerDuration(after)).toBe(true);
    });
  });
});
