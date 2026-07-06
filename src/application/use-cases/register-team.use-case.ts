import { EntityId } from '../../domain/value-objects/entity-id';
import { Team, TeamMember } from '../../domain/entities/team';
import { TeamRepository } from '../ports/team.repository';

export interface RegisterTeamInput {
  name: string;
  memberNames: string[];
  logo?: string;
}

/**
 * Find-or-create por nombre (case/whitespace-insensitive): si un equipo con
 * ese nombre ya existe, se reutiliza — esto es lo que permite reingresar
 * desde otro dispositivo (basta con escribir el mismo nombre) y evita
 * duplicados accidentales. `memberNames` del intento repetido se ignora a
 * propósito; gana la lista de integrantes original.
 *
 * Riesgo aceptado: dos equipos físicos distintos que elijan el mismo nombre
 * colisionan y comparten identidad. Es el trade-off de identificar equipos
 * por nombre en vez de por código/token — no se mitiga aquí.
 */
export class RegisterTeamUseCase {
  constructor(private readonly teamRepository: TeamRepository) {}

  async execute(input: RegisterTeamInput): Promise<Team> {
    const existing = await this.teamRepository.findByName(input.name);
    if (existing) {
      return existing;
    }

    const members: TeamMember[] = input.memberNames.map((fullName) => ({ fullName }));
    const team = new Team(EntityId.generate(), input.name, members, input.logo ?? null);

    await this.teamRepository.save(team);
    return team;
  }
}
