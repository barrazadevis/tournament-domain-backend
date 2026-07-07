import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterTeamDto {
  @ApiProperty({ example: 'Los Refactorizadores' })
  @IsString()
  name!: string;

  @ApiProperty({ example: ['Ana Pérez', 'Luis Gómez'], type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  memberNames!: string[];

  @ApiPropertyOptional({ example: '🦁', description: 'Emoji elegido de la lista predeterminada del frontend' })
  @IsOptional()
  @IsString()
  logo?: string;
}

export class RejoinTeamDto {
  @ApiProperty({ example: 'XK7M2P', description: 'Código único que se mostró al registrar el equipo' })
  @IsString()
  @MinLength(4)
  code!: string;
}

export class CreateTournamentDto {
  @ApiProperty({ example: 'Torneo Eliminatorio de Casos - Grupo A' })
  @IsString()
  name!: string;
}

export class RenameTournamentDto {
  @ApiProperty({ example: 'Torneo Eliminatorio de Casos - Grupo B' })
  @IsString()
  name!: string;
}

export class StartTournamentCaseDto {
  @ApiProperty({ example: 'Cálculo de bono de vendedores' })
  @IsString()
  title!: string;

  @ApiProperty({ example: 'Diseñar el ciclo para calcular el bono de 20 vendedores según sus ventas' })
  @IsString()
  description!: string;
}

export class StartTournamentDto {
  @ApiProperty({
    description: 'IDs de los equipos inscritos. Si no es potencia de 2, arranca la clasificatoria.',
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  teamIds!: string[];

  @ApiProperty({
    description: 'Un caso por ronda (incluyendo la clasificatoria si aplica), en orden.',
    type: [StartTournamentCaseDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StartTournamentCaseDto)
  cases!: StartTournamentCaseDto[];

  @ApiProperty({ example: 300, description: 'Duración del timer en segundos' })
  @IsInt()
  @Min(1)
  timerDurationSeconds!: number;
}

export class SubmitSolutionDto {
  @ApiProperty()
  @IsString()
  teamId!: string;

  @ApiProperty({ example: 'Estructura: Para. Pseudocódigo: ... Justificación: ...' })
  @IsString()
  content!: string;
}

export class JudgeVerdictDto {
  @ApiProperty({ description: 'Equipo cuya submission se está juzgando' })
  @IsString()
  teamId!: string;

  @ApiProperty({ description: 'true = aprobar, false = rechazar' })
  @IsBoolean()
  approve!: boolean;
}

export class JudgeQualifyingVerdictDto {
  @ApiProperty({ description: 'true = aprobar, false = rechazar' })
  @IsBoolean()
  approve!: boolean;
}

export class AdvanceRoundDto {
  @ApiProperty({ example: 'Semifinal' })
  @IsString()
  nextRoundName!: string;

  @ApiProperty({ example: 300 })
  @IsInt()
  @Min(1)
  timerDurationSeconds!: number;
}

export class BootstrapUserDto {
  @ApiProperty({ example: 'profesor@colegio.edu' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'unaClaveSegura123' })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class LoginDto {
  @ApiProperty({ example: 'profesor@colegio.edu' })
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  password!: string;
}

export class CreateUserDto {
  @ApiProperty({ example: 'colega@colegio.edu' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'unaClaveSegura123' })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'nuevoemail@colegio.edu' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'unaClaveNueva123' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
