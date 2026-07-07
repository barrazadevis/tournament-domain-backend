import {
  Body,
  ConflictException,
  Controller,
  Get,
  Inject,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BootstrapUserUseCase } from '../../../application/use-cases/bootstrap-user.use-case';
import { LoginUseCase } from '../../../application/use-cases/login.use-case';
import { LogoutUseCase } from '../../../application/use-cases/logout.use-case';
import { UserRepository } from '../../../application/ports/user.repository';
import { BootstrapUserDto, LoginDto } from '../dto/requests.dto';
import { USER_REPOSITORY } from '../tokens';
import { SessionAuthGuard, AuthenticatedRequestUser } from '../guards/session-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly bootstrapUser: BootstrapUserUseCase,
    private readonly login: LoginUseCase,
    private readonly logout: LogoutUseCase,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
  ) {}

  @ApiOperation({ summary: 'Saber si ya existe algún usuario (decide bootstrap vs login en el frontend)' })
  @Get('status')
  async status() {
    const count = await this.userRepository.count();
    return { initialized: count > 0 };
  }

  @ApiOperation({ summary: 'Crear el primer profesor (solo funciona si aún no hay ningún usuario)' })
  @Post('bootstrap')
  async bootstrap(@Body() dto: BootstrapUserDto) {
    try {
      const result = await this.bootstrapUser.execute(dto);
      return { token: result.token, user: { id: result.user.getId().toString(), email: result.user.getEmail() } };
    } catch (error) {
      throw new ConflictException((error as Error).message);
    }
  }

  @ApiOperation({ summary: 'Iniciar sesión' })
  @Post('login')
  async doLogin(@Body() dto: LoginDto) {
    try {
      const result = await this.login.execute(dto);
      return { token: result.token, user: { id: result.user.getId().toString(), email: result.user.getEmail() } };
    } catch (error) {
      throw new UnauthorizedException((error as Error).message);
    }
  }

  @ApiOperation({ summary: 'Cerrar sesión' })
  @ApiBearerAuth()
  @UseGuards(SessionAuthGuard)
  @Post('logout')
  async doLogout(@Req() req: { sessionToken: string }) {
    await this.logout.execute(req.sessionToken);
    return { status: 'ok' };
  }

  @ApiOperation({ summary: 'Datos del usuario autenticado (para revalidar el token guardado en el frontend)' })
  @ApiBearerAuth()
  @UseGuards(SessionAuthGuard)
  @Get('me')
  async me(@Req() req: { user: AuthenticatedRequestUser }) {
    return req.user;
  }
}
