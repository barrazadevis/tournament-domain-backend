import { BadRequestException, Body, Controller, Delete, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RegisterUserUseCase } from '../../../application/use-cases/register-user.use-case';
import { UpdateUserUseCase } from '../../../application/use-cases/update-user.use-case';
import { DeleteUserUseCase } from '../../../application/use-cases/delete-user.use-case';
import { UserRepository } from '../../../application/ports/user.repository';
import { CreateUserDto, UpdateUserDto } from '../dto/requests.dto';
import { USER_REPOSITORY } from '../tokens';
import { SessionAuthGuard } from '../guards/session-auth.guard';

function toPublicJSON(user: { getId(): { toString(): string }; getEmail(): string; getCreatedAt(): Date }) {
  return { id: user.getId().toString(), email: user.getEmail(), createdAt: user.getCreatedAt().toISOString() };
}

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(SessionAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly registerUser: RegisterUserUseCase,
    private readonly updateUser: UpdateUserUseCase,
    private readonly deleteUser: DeleteUserUseCase,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
  ) {}

  @ApiOperation({ summary: 'Listar los usuarios con acceso al panel profesor' })
  @Get()
  async findAll() {
    const users = await this.userRepository.findAll();
    return users.map(toPublicJSON);
  }

  @ApiOperation({ summary: 'Agregar otro profesor con acceso al panel' })
  @Post()
  async create(@Body() dto: CreateUserDto) {
    try {
      const user = await this.registerUser.execute(dto);
      return toPublicJSON(user);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }

  @ApiOperation({ summary: 'Editar email y/o contraseña de un usuario' })
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    try {
      const user = await this.updateUser.execute({ userId: id, ...dto });
      return toPublicJSON(user);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }

  @ApiOperation({ summary: 'Eliminar un usuario (rechaza dejar el panel sin ningún usuario)' })
  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      await this.deleteUser.execute(id);
      return { status: 'ok' };
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }
}
