import { Tournament } from '../../../domain/entities/tournament';
import { Match } from '../../../domain/entities/match';
import { Submission } from '../../../domain/entities/submission';

function presentSubmission(submission: Submission) {
  return {
    id: submission.getId().toString(),
    teamId: submission.getTeamId().toString(),
    content: submission.getContent(),
    submittedAt: submission.getSubmittedAt().toISOString(),
    verdict: submission.getVerdict(),
  };
}

function presentMatch(match: Match) {
  return {
    id: match.getId().toString(),
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
    submissions: match.getSubmissions().map(presentSubmission),
  };
}

/**
 * TournamentPresenter: única responsabilidad es traducir el agregado de
 * dominio a un contrato JSON estable. Nunca serializamos las entidades
 * directamente (JSON.stringify expondría su representación interna, ej.
 * EntityId como {value: "..."}) — esto es lo que consume el frontend.
 */
export class TournamentPresenter {
  static toJSON(tournament: Tournament) {
    return {
      id: tournament.getId().toString(),
      name: tournament.getName(),
      status: tournament.getStatus(),
      rounds: tournament.getRounds().map((round) => ({
        id: round.getId().toString(),
        name: round.getName(),
        order: round.getOrder(),
        isComplete: round.isComplete(),
        matches: round.getMatches().map(presentMatch),
      })),
    };
  }
}
