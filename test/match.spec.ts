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

      match.approveCurrentSubmission(teamAId, now);
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
      match.rejectCurrentSubmission(teamAId, now);

      expect(match.getStatus()).toBe(MatchStatus.ACTIVE);
      expect(match.getResolution()).toBeNull();

      const goodSubmission = new Submission(
        EntityId.generate(),
        teamBId,
        'Respuesta corregida por el rival',
        now,
      );
      match.submitSolution(goodSubmission);
      match.approveCurrentSubmission(teamBId, now);

      expect(match.getWinnerId()?.equals(teamBId)).toBe(true);
    });

    it('no permite que un equipo ya descalificado vuelva a intentar', () => {
      const { match, teamAId } = buildMatch();
      const now = new Date();
      match.start(now);

      match.submitSolution(new Submission(EntityId.generate(), teamAId, 'Intento 1', now));
      match.rejectCurrentSubmission(teamAId, now);

      expect(() =>
        match.submitSolution(new Submission(EntityId.generate(), teamAId, 'Intento 2', now)),
      ).toThrow('descalificado');
    });

    it('resuelve sin ganador si ambos equipos son rechazados', () => {
      const { match, teamAId, teamBId } = buildMatch();
      const now = new Date();
      match.start(now);

      match.submitSolution(new Submission(EntityId.generate(), teamAId, 'Intento A', now));
      match.rejectCurrentSubmission(teamAId, now);

      match.submitSolution(new Submission(EntityId.generate(), teamBId, 'Intento B', now));
      match.rejectCurrentSubmission(teamBId, now);

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
      match.approveCurrentSubmission(teamAId, now);

      expect(() => match.approveCurrentSubmission(teamAId, now)).toThrow();
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

  describe('submissions en paralelo', () => {
    it('permite que ambos equipos envíen su solución sin bloquearse entre sí', () => {
      const { match, teamAId, teamBId } = buildMatch();
      const now = new Date();
      match.start(now);

      match.submitSolution(new Submission(EntityId.generate(), teamAId, 'Solución A', now));
      expect(match.getStatus()).toBe(MatchStatus.AWAITING_JUDGMENT);

      match.submitSolution(new Submission(EntityId.generate(), teamBId, 'Solución B', now));
      expect(match.getStatus()).toBe(MatchStatus.AWAITING_JUDGMENT);
      expect(match.getSubmissions()).toHaveLength(2);
    });

    it('canAnyTeamStillSubmit: true si nadie ha enviado, false una vez que ambos ya enviaron', () => {
      const { match, teamAId, teamBId } = buildMatch();
      const now = new Date();
      match.start(now);
      expect(match.canAnyTeamStillSubmit()).toBe(true);

      match.submitSolution(new Submission(EntityId.generate(), teamAId, 'Solución A', now));
      expect(match.canAnyTeamStillSubmit()).toBe(true); // B todavía puede enviar

      match.submitSolution(new Submission(EntityId.generate(), teamBId, 'Solución B', now));
      expect(match.canAnyTeamStillSubmit()).toBe(false); // ya nadie puede enviar más
    });

    it('canAnyTeamStillSubmit: false si el único que faltaba quedó descalificado', () => {
      const { match, teamAId, teamBId } = buildMatch();
      const now = new Date();
      match.start(now);

      match.submitSolution(new Submission(EntityId.generate(), teamAId, 'Solución A', now));
      match.rejectCurrentSubmission(teamAId, now); // A descalificado, match vuelve a ACTIVE
      expect(match.canAnyTeamStillSubmit()).toBe(true); // B aún puede enviar

      match.submitSolution(new Submission(EntityId.generate(), teamBId, 'Solución B', now));
      expect(match.canAnyTeamStillSubmit()).toBe(false);
    });

    it('no permite que el mismo equipo tenga dos submissions pendientes a la vez', () => {
      const { match, teamAId } = buildMatch();
      const now = new Date();
      match.start(now);
      match.submitSolution(new Submission(EntityId.generate(), teamAId, 'Intento 1', now));

      expect(() =>
        match.submitSolution(new Submission(EntityId.generate(), teamAId, 'Intento 2', now)),
      ).toThrow('pendiente de revisión');
    });

    it('si se aprueba a A mientras B tiene una submission pendiente, el match cierra y la de B queda sin efecto', () => {
      const { match, teamAId, teamBId } = buildMatch();
      const now = new Date();
      match.start(now);
      match.submitSolution(new Submission(EntityId.generate(), teamAId, 'Solución A', now));
      match.submitSolution(new Submission(EntityId.generate(), teamBId, 'Solución B', now));

      match.approveCurrentSubmission(teamAId, now);

      expect(match.getStatus()).toBe(MatchStatus.RESOLVED);
      expect(match.getWinnerId()?.equals(teamAId)).toBe(true);
      const bSubmission = match.getSubmissions().find((s) => s.getTeamId().equals(teamBId));
      expect(bSubmission?.isPending()).toBe(true);
    });

    it('si se rechaza a A y B tiene una submission pendiente, el match se queda en AWAITING_JUDGMENT', () => {
      const { match, teamAId, teamBId } = buildMatch();
      const now = new Date();
      match.start(now);
      match.submitSolution(new Submission(EntityId.generate(), teamAId, 'Solución A', now));
      match.submitSolution(new Submission(EntityId.generate(), teamBId, 'Solución B', now));

      match.rejectCurrentSubmission(teamAId, now);

      expect(match.getStatus()).toBe(MatchStatus.AWAITING_JUDGMENT);
      expect(match.getResolution()).toBeNull();

      match.approveCurrentSubmission(teamBId, now);
      expect(match.getWinnerId()?.equals(teamBId)).toBe(true);
    });
  });

  describe('repetir match (restart)', () => {
    it('permite repetir un match RESOLVED/NO_WINNER sin ninguna submission', () => {
      const { match } = buildMatch();
      const now = new Date();
      match.start(now);
      match.expireTimer();
      expect(match.getStatus()).toBe(MatchStatus.RESOLVED);
      expect(match.getResolution()).toBe('NO_WINNER');

      match.restart();

      expect(match.getStatus()).toBe(MatchStatus.PENDING);
      expect(match.getResolution()).toBeNull();
      expect(match.getTimerStartedAt()).toBeNull();
    });

    it('no permite repetir si hubo submissions (aunque haya terminado NO_WINNER)', () => {
      const { match, teamAId, teamBId } = buildMatch();
      const now = new Date();
      match.start(now);
      match.submitSolution(new Submission(EntityId.generate(), teamAId, 'Intento A', now));
      match.rejectCurrentSubmission(teamAId, now);
      match.submitSolution(new Submission(EntityId.generate(), teamBId, 'Intento B', now));
      match.rejectCurrentSubmission(teamBId, now);
      expect(match.getResolution()).toBe('NO_WINNER');

      expect(() => match.restart()).toThrow('hubo equipos que sí enviaron solución');
    });

    it('no permite repetir un match que terminó con ganador', () => {
      const { match, teamAId } = buildMatch();
      const now = new Date();
      match.start(now);
      match.submitSolution(new Submission(EntityId.generate(), teamAId, 'Solución', now));
      match.approveCurrentSubmission(teamAId, now);

      expect(() => match.restart()).toThrow('Solo se puede repetir un match que terminó sin ganador');
    });
  });
});
