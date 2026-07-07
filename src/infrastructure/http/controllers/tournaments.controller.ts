import { Body, ConflictException, Controller, Delete, Get, Inject, NotFoundException, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SessionAuthGuard } from '../guards/session-auth.guard';
import { CreateTournamentUseCase } from '../../../application/use-cases/create-tournament.use-case';
import { StartTournamentUseCase } from '../../../application/use-cases/start-tournament.use-case';
import { SubmitQualifyingSolutionUseCase } from '../../../application/use-cases/submit-qualifying-solution.use-case';
import { JudgeQualifyingSubmissionUseCase } from '../../../application/use-cases/judge-qualifying-submission.use-case';
import { FinalizeQualifyingRoundUseCase } from '../../../application/use-cases/finalize-qualifying-round.use-case';
import { AdvanceToNextRoundUseCase } from '../../../application/use-cases/advance-to-next-round.use-case';
import { RenameTournamentUseCase } from '../../../application/use-cases/rename-tournament.use-case';
import { DeleteTournamentUseCase } from '../../../application/use-cases/delete-tournament.use-case';
import { ResetTournamentUseCase } from '../../../application/use-cases/reset-tournament.use-case';
import { EntityId } from '../../../domain/value-objects/entity-id';
import { TournamentRepository } from '../../../application/ports/tournament.repository';
import { QualifyingRoundRepository } from '../../../application/ports/qualifying-round.repository';
import { TournamentPresenter } from '../presenters/tournament.presenter';
import {
  CreateTournamentDto,
  RenameTournamentDto,
  StartTournamentDto,
  SubmitSolutionDto,
  JudgeQualifyingVerdictDto,
  AdvanceRoundDto,
} from '../dto/requests.dto';
import { TOURNAMENT_REPOSITORY, QUALIFYING_ROUND_REPOSITORY } from '../tokens';

@ApiTags('tournaments')
@Controller('tournaments')
export class TournamentsController {
  constructor(
    private readonly createTournament: CreateTournamentUseCase,
    private readonly startTournament: StartTournamentUseCase,
    private readonly submitQualifyingSolution: SubmitQualifyingSolutionUseCase,
    private readonly judgeQualifyingSubmission: JudgeQualifyingSubmissionUseCase,
    private readonly finalizeQualifyingRound: FinalizeQualifyingRoundUseCase,
    private readonly advanceToNextRound: AdvanceToNextRoundUseCase,
    private readonly renameTournament: RenameTournamentUseCase,
    private readonly deleteTournament: DeleteTournamentUseCase,
    private readonly resetTournament: ResetTournamentUseCase,
    @Inject(TOURNAMENT_REPOSITORY) private readonly tournamentRepository: TournamentRepository,
    @Inject(QUALIFYING_ROUND_REPOSITORY)
    private readonly qualifyingRoundRepository: QualifyingRoundRepository,
  ) {}

  @ApiOperation({ summary: 'Crear un torneo vacío' })
  @ApiBearerAuth()
  @UseGuards(SessionAuthGuard)
  @Post()
  async create(@Body() dto: CreateTournamentDto) {
    const tournament = await this.createTournament.execute(dto);
    return TournamentPresenter.toJSON(tournament);
  }

  @ApiOperation({ summary: 'Listar todos los torneos creados (para elegir cuál administrar/ver)' })
  @Get()
  async findAll() {
    const tournaments = await this.tournamentRepository.findAll();
    return tournaments.map((t) => ({
      id: t.getId().toString(),
      name: t.getName(),
      status: t.getStatus(),
    }));
  }

  @ApiOperation({ summary: 'Consultar el estado completo de un torneo (rondas, matches, submissions)' })
  @Get(':id')
  async getById(@Param('id') id: string) {
    const tournament = await this.tournamentRepository.findById(EntityId.fromString(id));
    if (!tournament) throw new NotFoundException(`Torneo ${id} no encontrado`);
    return TournamentPresenter.toJSON(tournament);
  }

  @ApiOperation({ summary: 'Renombrar un torneo' })
  @ApiBearerAuth()
  @UseGuards(SessionAuthGuard)
  @Patch(':id')
  async rename(@Param('id') id: string, @Body() dto: RenameTournamentDto) {
    const tournament = await this.renameTournament.execute({ tournamentId: id, name: dto.name });
    return TournamentPresenter.toJSON(tournament);
  }

  @ApiOperation({ summary: 'Eliminar un torneo (y todo lo que dependa de él: rondas, matches, clasificatoria)' })
  @ApiBearerAuth()
  @UseGuards(SessionAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.deleteTournament.execute({ tournamentId: id });
    return { status: 'ok' };
  }

  @ApiOperation({
    summary: 'Reiniciar un torneo: borra rondas/matches/clasificatoria y lo vuelve a DRAFT',
  })
  @ApiBearerAuth()
  @UseGuards(SessionAuthGuard)
  @Post(':id/reset')
  async reset(@Param('id') id: string) {
    await this.resetTournament.execute({ tournamentId: id });
    return { status: 'ok' };
  }

  @ApiOperation({ summary: 'Consultar el estado de la ronda clasificatoria (si existe)' })
  @Get(':id/qualifying-round')
  async getQualifyingRound(@Param('id') id: string) {
    const round = await this.qualifyingRoundRepository.findByTournamentId(EntityId.fromString(id));
    if (!round) throw new NotFoundException(`Este torneo no tiene ronda clasificatoria activa`);

    return {
      id: round.getId().toString(),
      businessCase: {
        title: round.getBusinessCase().getTitle(),
        description: round.getBusinessCase().getDescription(),
      },
      timerDurationSeconds: round.getTimerDurationSeconds(),
      targetQualifierCount: round.getTargetQualifierCount(),
      participantTeamIds: round.getParticipantTeamIds(),
      submissions: round.getSubmissions().map((s) => ({
        teamId: s.getTeamId().toString(),
        content: s.getContent(),
        submittedAt: s.getSubmittedAt().toISOString(),
        verdict: s.getVerdict(),
      })),
    };
  }

  @ApiOperation({
    summary: 'Iniciar el torneo (decide clasificatoria vs bracket directo según potencia de 2)',
  })
  @ApiBearerAuth()
  @UseGuards(SessionAuthGuard)
  @Post(':id/start')
  async start(@Param('id') id: string, @Body() dto: StartTournamentDto) {
    try {
      return await this.startTournament.execute({ tournamentId: id, ...dto });
    } catch (error) {
      throw new ConflictException((error as Error).message);
    }
  }

  @ApiOperation({ summary: 'Enviar la solución de un equipo en la ronda clasificatoria' })
  @Post(':id/qualifying-submissions')
  async submitQualifying(@Param('id') id: string, @Body() dto: SubmitSolutionDto) {
    await this.submitQualifyingSolution.execute({
      tournamentId: id,
      teamId: dto.teamId,
      content: dto.content,
      submittedAt: new Date(),
    });
    return { status: 'ok' };
  }

  @ApiOperation({ summary: 'Aprobar o rechazar la submission de un equipo en la clasificatoria' })
  @ApiBearerAuth()
  @UseGuards(SessionAuthGuard)
  @Post(':id/qualifying-submissions/:teamId/verdict')
  async judgeQualifying(
    @Param('id') id: string,
    @Param('teamId') teamId: string,
    @Body() dto: JudgeQualifyingVerdictDto,
  ) {
    await this.judgeQualifyingSubmission.execute({
      tournamentId: id,
      teamId,
      approve: dto.approve,
      now: new Date(),
    });
    return { status: 'ok' };
  }

  @ApiOperation({ summary: 'Cerrar la clasificatoria y generar la ronda de Cuartos con los clasificados' })
  @ApiBearerAuth()
  @UseGuards(SessionAuthGuard)
  @Post(':id/qualifying-round/finalize')
  async finalizeQualifying(@Param('id') id: string) {
    return this.finalizeQualifyingRound.execute({ tournamentId: id });
  }

  @ApiOperation({ summary: 'Avanzar de ronda (empareja ganadores aleatoriamente, o cierra el torneo si era la final)' })
  @ApiBearerAuth()
  @UseGuards(SessionAuthGuard)
  @Post(':id/rounds/:order/advance')
  async advanceRound(
    @Param('id') id: string,
    @Param('order') order: string,
    @Body() dto: AdvanceRoundDto,
  ) {
    return this.advanceToNextRound.execute({
      tournamentId: id,
      currentRoundOrder: Number(order),
      nextRoundName: dto.nextRoundName,
      timerDurationSeconds: dto.timerDurationSeconds,
    });
  }
}
