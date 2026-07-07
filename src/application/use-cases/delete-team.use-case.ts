import { EntityId } from '../../domain/value-objects/entity-id';
import { TeamRepository } from '../ports/team.repository';

export class DeleteTeamUseCase {
  constructor(private readonly teamRepository: TeamRepository) {}

  async execute(teamId: string): Promise<void> {
    const id = EntityId.fromString(teamId);
    const team = await this.teamRepository.findById(id);
    if (!team) {
      throw new Error('Equipo no encontrado');
    }

    const inUse = await this.teamRepository.isInUse(id);
    if (inUse) {
      throw new Error('No puedes eliminar un equipo que ya participa en un torneo iniciado');
    }

    await this.teamRepository.delete(id);
  }
}
