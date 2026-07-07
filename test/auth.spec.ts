import {
  InMemoryUserRepository,
  InMemorySessionRepository,
  FakePasswordHasher,
} from './fakes/in-memory-repositories';
import { RegisterUserUseCase } from '../src/application/use-cases/register-user.use-case';
import { BootstrapUserUseCase } from '../src/application/use-cases/bootstrap-user.use-case';
import { LoginUseCase } from '../src/application/use-cases/login.use-case';
import { LogoutUseCase } from '../src/application/use-cases/logout.use-case';
import { UpdateUserUseCase } from '../src/application/use-cases/update-user.use-case';
import { DeleteUserUseCase } from '../src/application/use-cases/delete-user.use-case';

function buildUseCases() {
  const userRepository = new InMemoryUserRepository();
  const sessionRepository = new InMemorySessionRepository();
  const passwordHasher = new FakePasswordHasher();
  const registerUser = new RegisterUserUseCase(userRepository, passwordHasher);

  return {
    userRepository,
    sessionRepository,
    registerUser,
    bootstrapUser: new BootstrapUserUseCase(userRepository, sessionRepository, registerUser),
    login: new LoginUseCase(userRepository, sessionRepository, passwordHasher),
    logout: new LogoutUseCase(sessionRepository),
    updateUser: new UpdateUserUseCase(userRepository, passwordHasher),
    deleteUser: new DeleteUserUseCase(userRepository, sessionRepository),
  };
}

describe('Autenticación', () => {
  describe('BootstrapUserUseCase', () => {
    it('crea el primer usuario y devuelve una sesión activa', async () => {
      const uc = buildUseCases();
      const result = await uc.bootstrapUser.execute({ email: 'profe@colegio.edu', password: 'claveSegura1' });

      expect(result.user.getEmail()).toBe('profe@colegio.edu');
      expect(result.token).toHaveLength(64);
      expect(await uc.userRepository.count()).toBe(1);
    });

    it('rechaza un segundo bootstrap si ya existe un usuario', async () => {
      const uc = buildUseCases();
      await uc.bootstrapUser.execute({ email: 'profe@colegio.edu', password: 'claveSegura1' });

      await expect(
        uc.bootstrapUser.execute({ email: 'otro@colegio.edu', password: 'claveSegura2' }),
      ).rejects.toThrow('Ya existe un usuario registrado');
    });
  });

  describe('LoginUseCase', () => {
    it('devuelve un token con credenciales correctas', async () => {
      const uc = buildUseCases();
      await uc.registerUser.execute({ email: 'profe@colegio.edu', password: 'claveSegura1' });

      const result = await uc.login.execute({ email: 'profe@colegio.edu', password: 'claveSegura1' });
      expect(result.token).toHaveLength(64);
    });

    it('rechaza contraseña incorrecta con un mensaje genérico', async () => {
      const uc = buildUseCases();
      await uc.registerUser.execute({ email: 'profe@colegio.edu', password: 'claveSegura1' });

      await expect(uc.login.execute({ email: 'profe@colegio.edu', password: 'otraClave' })).rejects.toThrow(
        'Credenciales inválidas',
      );
    });

    it('rechaza email inexistente con el mismo mensaje genérico', async () => {
      const uc = buildUseCases();
      await expect(
        uc.login.execute({ email: 'nadie@colegio.edu', password: 'claveSegura1' }),
      ).rejects.toThrow('Credenciales inválidas');
    });
  });

  describe('LogoutUseCase', () => {
    it('invalida la sesión: un login posterior con el mismo token ya no encuentra sesión', async () => {
      const uc = buildUseCases();
      await uc.registerUser.execute({ email: 'profe@colegio.edu', password: 'claveSegura1' });
      const { token } = await uc.login.execute({ email: 'profe@colegio.edu', password: 'claveSegura1' });

      expect(await uc.sessionRepository.findByToken(token)).not.toBeNull();
      await uc.logout.execute(token);
      expect(await uc.sessionRepository.findByToken(token)).toBeNull();
    });
  });

  describe('UpdateUserUseCase', () => {
    it('cambia el email de un usuario', async () => {
      const uc = buildUseCases();
      const user = await uc.registerUser.execute({ email: 'profe@colegio.edu', password: 'claveSegura1' });

      const updated = await uc.updateUser.execute({ userId: user.getId().toString(), email: 'nuevo@colegio.edu' });
      expect(updated.getEmail()).toBe('nuevo@colegio.edu');
    });

    it('cambia la contraseña (se puede loguear con la nueva, no con la vieja)', async () => {
      const uc = buildUseCases();
      const user = await uc.registerUser.execute({ email: 'profe@colegio.edu', password: 'claveVieja1' });

      await uc.updateUser.execute({ userId: user.getId().toString(), password: 'claveNueva1' });

      await expect(uc.login.execute({ email: 'profe@colegio.edu', password: 'claveVieja1' })).rejects.toThrow();
      const result = await uc.login.execute({ email: 'profe@colegio.edu', password: 'claveNueva1' });
      expect(result.token).toHaveLength(64);
    });
  });

  describe('DeleteUserUseCase', () => {
    it('rechaza eliminar al último usuario restante', async () => {
      const uc = buildUseCases();
      const user = await uc.registerUser.execute({ email: 'profe@colegio.edu', password: 'claveSegura1' });

      await expect(uc.deleteUser.execute(user.getId().toString())).rejects.toThrow(
        'No puedes eliminar al último usuario',
      );
      expect(await uc.userRepository.count()).toBe(1);
    });

    it('permite eliminar un usuario si queda al menos otro', async () => {
      const uc = buildUseCases();
      const first = await uc.registerUser.execute({ email: 'profe1@colegio.edu', password: 'claveSegura1' });
      await uc.registerUser.execute({ email: 'profe2@colegio.edu', password: 'claveSegura2' });

      await uc.deleteUser.execute(first.getId().toString());
      expect(await uc.userRepository.count()).toBe(1);
    });
  });
});
