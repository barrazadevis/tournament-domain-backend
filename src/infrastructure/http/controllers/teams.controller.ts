import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RegisterTeamUseCase } from '../../../application/use-cases/register-team.use-case';
import { RegisterTeamDto } from '../dto/requests.dto';
import { TeamRepository } from '../../../application/ports/team.repository';
import { TEAM_REPOSITORY } from '../tokens';

@ApiTags('teams')
@Controller('teams')
export class TeamsController {
  constructor(
    private readonly registerTeam: RegisterTeamUseCase,
    @Inject(TEAM_REPOSITORY) private readonly teamRepository: TeamRepository,
  ) {}

  @ApiOperation({ summary: 'Inscribir un nuevo equipo' })
  @Post()
  async register(@Body() dto: RegisterTeamDto) {
    const team = await this.registerTeam.execute(dto);
    return { id: team.getId().toString(), name: team.getName(), logo: team.getLogo() };
  }

  @ApiOperation({ summary: 'Listar todos los equipos inscritos' })
  @Get()
  async findAll() {
    const teams = await this.teamRepository.findAll();
    return teams.map((team) => ({
      id: team.getId().toString(),
      name: team.getName(),
      members: team.getMembers().map((m) => m.fullName),
      logo: team.getLogo(),
    }));
  }
}
