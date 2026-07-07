import { EntityId } from '../../domain/value-objects/entity-id';
import { TeamCode } from '../../domain/value-objects/team-code';
import { Team, TeamMember } from '../../domain/entities/team';
import { TeamRepository } from '../ports/team.repository';

export interface RegisterTeamInput {
  name: string;
  memberNames: string[];
  logo?: string;
}

const MAX_CODE_GENERATION_ATTEMPTS = 5;

/**
 * Siempre crea un equipo nuevo — YA NO reutiliza uno existente por nombre.
 *
 * Antes hacía find-or-create por nombre (case/whitespace-insensitive) para
 * permitir reingreso desde otro dispositivo sin código. Se revirtió a
 * pedido explícito del usuario: cualquiera podía escribir el nombre exacto
 * de un equipo rival y entrar COMO ese equipo para sabotearlo (enviar
 * soluciones basura). El reingreso ahora es por `TeamCode` (ver
 * `TeamsController.rejoin` / `TeamRepository.findByCode`), visible solo
 * para el equipo dueño y el profesor — nombres duplicados entre equipos
 * distintos son ahora legítimos y sin riesgo, porque la identidad ya no
 * depende del nombre.
 */
export class RegisterTeamUseCase {
  constructor(private readonly teamRepository: TeamRepository) {}

  async execute(input: RegisterTeamInput): Promise<Team> {
    const members: TeamMember[] = input.memberNames.map((fullName) => ({ fullName }));
    const code = await this.generateUniqueCode();
    const team = new Team(EntityId.generate(), input.name, members, code, input.logo ?? null);

    await this.teamRepository.save(team);
    return team;
  }

  private async generateUniqueCode(): Promise<TeamCode> {
    for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt++) {
      const code = TeamCode.generate();
      const existing = await this.teamRepository.findByCode(code.toString());
      if (!existing) return code;
    }
    throw new Error('No se pudo generar un código único para el equipo, intenta de nuevo');
  }
}
