import {
  InMemoryTeamRepository,
  InMemoryTournamentRepository,
  InMemoryBusinessCaseRepository,
  InMemoryQualifyingRoundRepository,
} from './fakes/in-memory-repositories';
import { RegisterTeamUseCase } from '../src/application/use-cases/register-team.use-case';
import { DeleteTeamUseCase } from '../src/application/use-cases/delete-team.use-case';
import { CreateTournamentUseCase } from '../src/application/use-cases/create-tournament.use-case';
import { StartTournamentUseCase } from '../src/application/use-cases/start-tournament.use-case';
import { SubmitQualifyingSolutionUseCase } from '../src/application/use-cases/submit-qualifying-solution.use-case';
import { JudgeQualifyingSubmissionUseCase } from '../src/application/use-cases/judge-qualifying-submission.use-case';
import { FinalizeQualifyingRoundUseCase } from '../src/application/use-cases/finalize-qualifying-round.use-case';
import { StartMatchUseCase } from '../src/application/use-cases/start-match.use-case';
import { SubmitMatchSolutionUseCase } from '../src/application/use-cases/submit-match-solution.use-case';
import { JudgeMatchSubmissionUseCase } from '../src/application/use-cases/judge-match-submission.use-case';
import { AdvanceToNextRoundUseCase } from '../src/application/use-cases/advance-to-next-round.use-case';
import { TournamentStatus } from '../src/domain/entities/tournament';

function makeCases(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    title: `Caso ${i + 1}`,
    description: `Descripción del caso ${i + 1}`,
  }));
}

function buildUseCases() {
  const teamRepository = new InMemoryTeamRepository();
  const tournamentRepository = new InMemoryTournamentRepository();
  const businessCaseRepository = new InMemoryBusinessCaseRepository();
  const qualifyingRoundRepository = new InMemoryQualifyingRoundRepository();

  return {
    teamRepository,
    tournamentRepository,
    registerTeam: new RegisterTeamUseCase(teamRepository),
    deleteTeam: new DeleteTeamUseCase(teamRepository),
    createTournament: new CreateTournamentUseCase(tournamentRepository),
    startTournament: new StartTournamentUseCase(
      tournamentRepository,
      teamRepository,
      businessCaseRepository,
      qualifyingRoundRepository,
    ),
    submitQualifyingSolution: new SubmitQualifyingSolutionUseCase(qualifyingRoundRepository),
    judgeQualifyingSubmission: new JudgeQualifyingSubmissionUseCase(qualifyingRoundRepository),
    finalizeQualifyingRound: new FinalizeQualifyingRoundUseCase(
      tournamentRepository,
      teamRepository,
      qualifyingRoundRepository,
      businessCaseRepository,
    ),
    startMatch: new StartMatchUseCase(tournamentRepository),
    submitMatchSolution: new SubmitMatchSolutionUseCase(tournamentRepository),
    judgeMatchSubmission: new JudgeMatchSubmissionUseCase(tournamentRepository),
    advanceToNextRound: new AdvanceToNextRoundUseCase(tournamentRepository, businessCaseRepository),
  };
}

describe('Casos de uso', () => {
  describe('RegisterTeamUseCase + CreateTournamentUseCase', () => {
    it('registra un equipo y crea un torneo en DRAFT', async () => {
      const uc = buildUseCases();
      const team = await uc.registerTeam.execute({ name: 'Los Refactorizadores', memberNames: ['Ana'] });
      const tournament = await uc.createTournament.execute({ name: 'Torneo de Casos' });

      expect(team.getName()).toBe('Los Refactorizadores');
      expect(tournament.getStatus()).toBe(TournamentStatus.DRAFT);
    });

    it('registrar dos veces el mismo nombre crea DOS equipos distintos (ya no hay dedupe por nombre)', async () => {
      const uc = buildUseCases();
      const teamA = await uc.registerTeam.execute({ name: 'Los Tiburones', memberNames: ['Ana'] });
      const teamB = await uc.registerTeam.execute({ name: 'Los Tiburones', memberNames: ['Beto'] });

      expect(teamA.getId().equals(teamB.getId())).toBe(false);
      expect(teamA.getCode().equals(teamB.getCode())).toBe(false);
    });
  });

  describe('DeleteTeamUseCase', () => {
    it('elimina un equipo que no está en uso', async () => {
      const uc = buildUseCases();
      const team = await uc.registerTeam.execute({ name: 'Equipo Libre', memberNames: ['Ana'] });

      await uc.deleteTeam.execute(team.getId().toString());

      expect(await uc.teamRepository.findById(team.getId())).toBeNull();
    });

    it('rechaza eliminar un equipo que ya participa en un torneo', async () => {
      const uc = buildUseCases();
      const team = await uc.registerTeam.execute({ name: 'Equipo Ocupado', memberNames: ['Ana'] });
      uc.teamRepository.markInUse(team.getId().toString());

      await expect(uc.deleteTeam.execute(team.getId().toString())).rejects.toThrow(
        'No puedes eliminar un equipo que ya participa en un torneo iniciado',
      );
    });
  });

  describe('StartTournamentUseCase', () => {
    it('con 8 equipos genera el bracket directo (sin clasificatoria) y exige 3 casos', async () => {
      const uc = buildUseCases();
      const tournament = await uc.createTournament.execute({ name: 'Torneo 8' });
      const teams = await Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          uc.registerTeam.execute({ name: `Equipo ${i + 1}`, memberNames: [`E${i}`] }),
        ),
      );

      const result = await uc.startTournament.execute({
        tournamentId: tournament.getId().toString(),
        teamIds: teams.map((t) => t.getId().toString()),
        cases: makeCases(3),
        timerDurationSeconds: 300,
      });

      expect(result.kind).toBe('BRACKET_STARTED');
      const saved = await uc.tournamentRepository.findById(tournament.getId());
      expect(saved!.getStatus()).toBe(TournamentStatus.IN_PROGRESS);
      expect(saved!.getRounds()).toHaveLength(1);
      expect(saved!.getRounds()[0].getMatches()).toHaveLength(4);
      expect(saved!.getPendingCaseIds()).toHaveLength(2); // Semifinal + Final, aún no consumidos
    });

    it('rechaza si la cantidad de casos no coincide con la cantidad de rondas', async () => {
      const uc = buildUseCases();
      const tournament = await uc.createTournament.execute({ name: 'Torneo 8 casos mal' });
      const teams = await Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          uc.registerTeam.execute({ name: `Equipo ${i + 1}`, memberNames: [`E${i}`] }),
        ),
      );

      await expect(
        uc.startTournament.execute({
          tournamentId: tournament.getId().toString(),
          teamIds: teams.map((t) => t.getId().toString()),
          cases: makeCases(1), // 8 equipos necesita 3 (Cuartos/Semifinal/Final)
          timerDurationSeconds: 300,
        }),
      ).rejects.toThrow('Se esperaban 3 casos');
    });

    it('con 9 equipos inicia una ronda clasificatoria y exige 4 casos (clasificatoria + 3 rondas)', async () => {
      const uc = buildUseCases();
      const tournament = await uc.createTournament.execute({ name: 'Torneo 9' });
      const teams = await Promise.all(
        Array.from({ length: 9 }, (_, i) =>
          uc.registerTeam.execute({ name: `Equipo ${i + 1}`, memberNames: [`E${i}`] }),
        ),
      );

      const result = await uc.startTournament.execute({
        tournamentId: tournament.getId().toString(),
        teamIds: teams.map((t) => t.getId().toString()),
        cases: makeCases(4),
        timerDurationSeconds: 300,
      });

      expect(result.kind).toBe('QUALIFYING_ROUND_STARTED');
      if (result.kind === 'QUALIFYING_ROUND_STARTED') {
        expect(result.targetQualifierCount).toBe(8);
      }
      const saved = await uc.tournamentRepository.findById(tournament.getId());
      expect(saved!.getRounds()).toHaveLength(0); // aún no hay bracket
      expect(saved!.getStatus()).toBe(TournamentStatus.QUALIFYING);
      expect(saved!.getPendingCaseIds()).toHaveLength(3); // Cuartos + Semifinal + Final
    });

    it('rechaza iniciar un torneo que ya tiene una clasificatoria en curso (bug: crasheaba con UNIQUE constraint)', async () => {
      const uc = buildUseCases();
      const tournament = await uc.createTournament.execute({ name: 'Torneo 9 bis' });
      const teams = await Promise.all(
        Array.from({ length: 9 }, (_, i) =>
          uc.registerTeam.execute({ name: `Equipo ${i + 1}`, memberNames: [`E${i}`] }),
        ),
      );
      const input = {
        tournamentId: tournament.getId().toString(),
        teamIds: teams.map((t) => t.getId().toString()),
        cases: makeCases(4),
        timerDurationSeconds: 300,
      };

      await uc.startTournament.execute(input);

      await expect(uc.startTournament.execute(input)).rejects.toThrow('El torneo ya fue iniciado');
    });

    it('rechaza iniciar un torneo que ya tiene el bracket directo generado', async () => {
      const uc = buildUseCases();
      const tournament = await uc.createTournament.execute({ name: 'Torneo 8 bis' });
      const teams = await Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          uc.registerTeam.execute({ name: `Equipo ${i + 1}`, memberNames: [`E${i}`] }),
        ),
      );
      const input = {
        tournamentId: tournament.getId().toString(),
        teamIds: teams.map((t) => t.getId().toString()),
        cases: makeCases(3),
        timerDurationSeconds: 300,
      };

      await uc.startTournament.execute(input);

      await expect(uc.startTournament.execute(input)).rejects.toThrow('El torneo ya fue iniciado');
    });
  });

  describe('Flujo completo con clasificatoria (9 equipos) hasta campeón', () => {
    it('clasifica, arma el bracket de 8, resuelve todo hasta declarar campeón usando un caso distinto por ronda', async () => {
      const uc = buildUseCases();
      const tournament = await uc.createTournament.execute({ name: 'Torneo Completo' });
      const teams = await Promise.all(
        Array.from({ length: 9 }, (_, i) =>
          uc.registerTeam.execute({ name: `Equipo ${i + 1}`, memberNames: [`E${i}`] }),
        ),
      );

      const cases = makeCases(4); // clasificatoria, Cuartos, Semifinal, Final
      await uc.startTournament.execute({
        tournamentId: tournament.getId().toString(),
        teamIds: teams.map((t) => t.getId().toString()),
        cases,
        timerDurationSeconds: 300,
      });

      // Los 9 equipos envían y son aprobados, excepto el equipo 9 (el más lento).
      const now = new Date('2026-01-01T10:00:00Z');
      for (let i = 0; i < teams.length; i++) {
        await uc.submitQualifyingSolution.execute({
          tournamentId: tournament.getId().toString(),
          teamId: teams[i].getId().toString(),
          content: `Intento ${i}`,
          submittedAt: new Date(now.getTime() + i * 1000),
        });
      }
      for (const team of teams) {
        await uc.judgeQualifyingSubmission.execute({
          tournamentId: tournament.getId().toString(),
          teamId: team.getId().toString(),
          approve: true,
          now,
        });
      }

      const finalizeResult = await uc.finalizeQualifyingRound.execute({
        tournamentId: tournament.getId().toString(),
      });
      expect(finalizeResult.qualifiedTeamNames).toHaveLength(8);
      expect(finalizeResult.qualifiedTeamNames).not.toContain('Equipo 9'); // el más lento queda fuera

      const afterFinalize = await uc.tournamentRepository.findById(tournament.getId());
      // El caso de Cuartos (cases[1]) ya se consumió; quedan Semifinal y Final.
      expect(afterFinalize!.getRounds()[0].getMatches()[0].getBusinessCase().getTitle()).toBe(cases[1].title);
      expect(afterFinalize!.getPendingCaseIds()).toHaveLength(2);

      // Resolvemos las 3 rondas (Cuartos -> Semis -> Final) hasta el campeón.
      let currentRoundOrder = 0;
      let championId: string | null = null;

      while (championId === null) {
        const tournamentState = await uc.tournamentRepository.findById(tournament.getId());
        const round = tournamentState!.getRoundByOrder(currentRoundOrder)!;

        for (const match of round.getMatches()) {
          await uc.startMatch.execute({
            matchId: match.getId().toString(),
            now,
          });
          await uc.submitMatchSolution.execute({
            matchId: match.getId().toString(),
            teamId: match.getTeamAId().toString(),
            content: 'Solución del equipo A',
            submittedAt: now,
          });
          await uc.judgeMatchSubmission.execute({
            matchId: match.getId().toString(),
            teamId: match.getTeamAId().toString(),
            approve: true,
            now,
          });
        }

        const advanceResult = await uc.advanceToNextRound.execute({
          tournamentId: tournament.getId().toString(),
          currentRoundOrder,
          nextRoundName: currentRoundOrder === 0 ? 'Semifinal' : 'Gran Final',
          timerDurationSeconds: 300,
        });

        if (advanceResult.kind === 'TOURNAMENT_FINISHED') {
          championId = advanceResult.championTeamId;
        } else {
          currentRoundOrder += 1;
          const midState = await uc.tournamentRepository.findById(tournament.getId());
          // Ronda de Semifinal debe usar cases[2], no repetir el caso de Cuartos.
          expect(midState!.getRoundByOrder(1)!.getMatches()[0].getBusinessCase().getTitle()).toBe(cases[2].title);
        }
      }

      const finalTournament = await uc.tournamentRepository.findById(tournament.getId());
      expect(finalTournament!.getStatus()).toBe(TournamentStatus.FINISHED);
      expect(championId).not.toBeNull();
      expect(finalTournament!.getPendingCaseIds()).toHaveLength(0); // se consumieron todos
      // El campeón debe ser uno de los 8 clasificados originales.
      expect(finalizeResult.qualifiedTeamNames.length).toBe(8);
    });
  });
});
