import { Body, Controller, Get, Inject, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SessionAuthGuard } from '../guards/session-auth.guard';
import { StartMatchUseCase } from '../../../application/use-cases/start-match.use-case';
import { SubmitMatchSolutionUseCase } from '../../../application/use-cases/submit-match-solution.use-case';
import { JudgeMatchSubmissionUseCase } from '../../../application/use-cases/judge-match-submission.use-case';
import { RestartMatchUseCase } from '../../../application/use-cases/restart-match.use-case';
import { SubmitSolutionDto, JudgeVerdictDto } from '../dto/requests.dto';
import { EntityId } from '../../../domain/value-objects/entity-id';
import { TournamentRepository } from '../../../application/ports/tournament.repository';
import { TOURNAMENT_REPOSITORY } from '../tokens';
import { MatchTimerService } from '../../websockets/match-timer.service';

@ApiTags('matches')
@Controller('matches')
export class MatchesController {
  constructor(
    private readonly startMatch: StartMatchUseCase,
    private readonly submitMatchSolution: SubmitMatchSolutionUseCase,
    private readonly judgeMatchSubmission: JudgeMatchSubmissionUseCase,
    private readonly restartMatch: RestartMatchUseCase,
    private readonly matchTimer: MatchTimerService,
    @Inject(TOURNAMENT_REPOSITORY) private readonly tournamentRepository: TournamentRepository,
  ) {}

  @ApiOperation({ summary: 'Consultar el estado de un match (resuelto por matchId, sin necesitar tournamentId)' })
  @Get(':matchId')
  async getById(@Param('matchId') matchId: string) {
    const id = EntityId.fromString(matchId);
    const tournament = await this.tournamentRepository.findByMatchId(id);
    if (!tournament) throw new NotFoundException(`Match ${matchId} no encontrado`);
    const match = tournament.findMatch(id)!;

    return {
      id: match.getId().toString(),
      tournamentId: tournament.getId().toString(),
      roundName: match.getRoundName(),
      teamAId: match.getTeamAId().toString(),
      teamBId: match.getTeamBId().toString(),
      status: match.getStatus(),
      winnerId: match.getWinnerId()?.toString() ?? null,
      resolution: match.getResolution(),
      timerDurationSeconds: match.getTimerDurationSeconds(),
      timerStartedAt: match.getTimerStartedAt()?.toISOString() ?? null,
      businessCase: {
        title: match.getBusinessCase().getTitle(),
        description: match.getBusinessCase().getDescription(),
      },
      submissions: match.getSubmissions().map((s) => ({
        teamId: s.getTeamId().toString(),
        verdict: s.getVerdict(),
      })),
    };
  }

  @ApiOperation({ summary: 'Iniciar un match (arranca el timer)' })
  @ApiBearerAuth()
  @UseGuards(SessionAuthGuard)
  @Post(':matchId/start')
  async start(@Param('matchId') matchId: string) {
    await this.startMatch.execute({ matchId, now: new Date() });
    return { status: 'ok' };
  }

  @ApiOperation({ summary: 'Enviar la solución de un equipo para un match' })
  @Post(':matchId/submissions')
  async submit(@Param('matchId') matchId: string, @Body() dto: SubmitSolutionDto) {
    const result = await this.submitMatchSolution.execute({
      matchId,
      teamId: dto.teamId,
      content: dto.content,
      submittedAt: new Date(),
    });
    if (result.shouldStopTimer) {
      this.matchTimer.stop(matchId);
    }
    return { status: 'ok' };
  }

  @ApiOperation({ summary: 'Aprobar o rechazar la submission de un equipo en un match' })
  @ApiBearerAuth()
  @UseGuards(SessionAuthGuard)
  @Post(':matchId/verdict')
  async judge(@Param('matchId') matchId: string, @Body() dto: JudgeVerdictDto) {
    await this.judgeMatchSubmission.execute({
      matchId,
      teamId: dto.teamId,
      approve: dto.approve,
      now: new Date(),
    });
    return { status: 'ok' };
  }

  @ApiOperation({
    summary: 'Repetir un match que terminó sin ganador y sin ninguna submission (silencio total)',
  })
  @ApiBearerAuth()
  @UseGuards(SessionAuthGuard)
  @Post(':matchId/restart')
  async restart(@Param('matchId') matchId: string) {
    await this.restartMatch.execute({ matchId });
    return { status: 'ok' };
  }
}
