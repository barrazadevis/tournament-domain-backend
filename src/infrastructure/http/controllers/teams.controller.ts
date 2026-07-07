import { BadRequestException, Body, Controller, Delete, Get, Inject, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RegisterTeamUseCase } from '../../../application/use-cases/register-team.use-case';
import { DeleteTeamUseCase } from '../../../application/use-cases/delete-team.use-case';
import { RegisterTeamDto, RejoinTeamDto } from '../dto/requests.dto';
import { TeamRepository } from '../../../application/ports/team.repository';
import { TEAM_REPOSITORY } from '../tokens';
import { SessionAuthGuard } from '../guards/session-auth.guard';

@ApiTags('teams')
@Controller('teams')
export class TeamsController {
  constructor(
    private readonly registerTeam: RegisterTeamUseCase,
    private readonly deleteTeam: DeleteTeamUseCase,
    @Inject(TEAM_REPOSITORY) private readonly teamRepository: TeamRepository,
  ) {}

  @ApiOperation({ summary: 'Inscribir un nuevo equipo (siempre crea uno nuevo, devuelve su código único)' })
  @Post()
  async register(@Body() dto: RegisterTeamDto) {
    const team = await this.registerTeam.execute(dto);
    return {
      id: team.getId().toString(),
      name: team.getName(),
      logo: team.getLogo(),
      code: team.getCode().toString(),
    };
  }

  @ApiOperation({ summary: 'Reingresar a un equipo existente usando su código único' })
  @Post('rejoin')
  async rejoin(@Body() dto: RejoinTeamDto) {
    const team = await this.teamRepository.findByCode(dto.code);
    if (!team) throw new NotFoundException('Código no encontrado');
    return { id: team.getId().toString(), name: team.getName(), logo: team.getLogo() };
  }

  @ApiOperation({ summary: 'Listar todos los equipos inscritos (sin código — endpoint público)' })
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

  @ApiOperation({ summary: 'Listar equipos con su código (solo profesor, para ayudar a quien lo pierda)' })
  @ApiBearerAuth()
  @UseGuards(SessionAuthGuard)
  @Get('roster')
  async roster() {
    const teams = await this.teamRepository.findAll();
    return teams.map((team) => ({
      id: team.getId().toString(),
      name: team.getName(),
      members: team.getMembers().map((m) => m.fullName),
      logo: team.getLogo(),
      code: team.getCode().toString(),
    }));
  }

  @ApiOperation({ summary: 'Eliminar un equipo que todavía no participa en ningún torneo iniciado' })
  @ApiBearerAuth()
  @UseGuards(SessionAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      await this.deleteTeam.execute(id);
      return { status: 'ok' };
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }
}
