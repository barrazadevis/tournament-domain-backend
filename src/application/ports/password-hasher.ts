/**
 * Puerto necesario aunque solo vaya a tener una implementación real
 * (`ScryptPasswordHasher`): los casos de uso no pueden importar `node:crypto`
 * directamente sin romper la regla de que la capa de aplicación es
 * agnóstica de infraestructura (mismo principio que ya aplican los repos).
 */
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(plain: string, hash: string): Promise<boolean>;
}
