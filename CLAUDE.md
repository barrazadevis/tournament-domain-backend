# Contexto del proyecto — Torneo TGA (Backend)

## Rol esperado
Actúa como Desarrollador de Software Senior: aplica SOLID, DRY, KISS, YAGNI;
elige patrones por contexto, no por preferencia; funciones pequeñas y
cohesivas; explica el razonamiento de diseño antes de codificar; señala
trade-offs; incluye tests como parte integral de cualquier cambio, no como
afterthought.

## Qué es esto
Backend de una dinámica de clase: un torneo de eliminación simple donde
equipos de estudiantes resuelven casos de negocio (estructuras repetitivas
en pseudocódigo/PSeInt) contra un timer, con un profesor como juez. Ver
`LOCAL_SETUP.md` para instrucciones de arranque.

Repo hermano: `tournament-frontend` (React + Vite, separado, consume esta
API vía REST + Socket.IO).

## Stack y por qué
- **NestJS** (no Express plano): DI nativa + decoradores encajan con
  Repository/Strategy/Observer sin ceremonia extra.
- **`node:sqlite`** (no Prisma/TypeORM/better-sqlite3): el entorno de
  desarrollo original no tenía salida de red a binarios de Prisma ni a
  compilación nativa. **Requiere Node 22.5+** — versiones intermedias de la
  rama 22.x (ej. 22.12) NO lo traen; usa la LTS más reciente.
- **Socket.IO** con 3 namespaces (`/team`, `/judge`, `/viewer`): Interface
  Segregation aplicado a WebSockets — un socket de equipo no puede ni por
  error escuchar eventos del juez.

## Arquitectura (Clean/Hexagonal)
```
src/
├── domain/           # Entidades + reglas puras, CERO imports de NestJS
├── application/      # Casos de uso + puertos (interfaces de repos)
└── infrastructure/
    ├── persistence/sqlite/   # Adapters concretos de los puertos
    ├── http/                 # Controllers, DTOs, AppModule (Composition Root)
    └── websockets/           # Gateways + MatchTimerService + EventBus
```

Los casos de uso (`application/use-cases`) son clases TS planas, **sin
decoradores de NestJS**. Se cablean en `app.module.ts` con `useFactory`
explícito. Si agregas un caso de uso nuevo, sigue ese patrón — no le pongas
`@Injectable()`.

## Decisiones de diseño no obvias (para no repetir errores ya corregidos)

1. **Emparejamiento aleatorio por ronda, no bracket fijo.** El ganador del
   match 1 NO siempre juega contra el ganador del match 2 en la siguiente
   ronda — `BracketAdvancementService.computeNextRoundPairings()` mezcla
   los ganadores de cero en cada ronda. Esto fue una corrección explícita
   sobre un diseño anterior de "árbol fijo" que el usuario rechazó.

2. **QualifyingRound en vez de byes.** Si el número de equipos no es
   potencia de 2, NINGÚN equipo pasa sin competir. Todos reciben el mismo
   caso simultáneamente; avanzan los más rápidos con veredicto APROBADO
   hasta llegar a la potencia de 2 inferior más cercana
   (`PowerOfTwoMath.largestPowerOfTwoLessOrEqual`).

3. **Resolución por `matchId`, no por `tournamentId` + `matchId`.**
   `StartMatchUseCase`, `SubmitMatchSolutionUseCase`,
   `JudgeMatchSubmissionUseCase` reciben solo `matchId` — resuelven el
   torneo dueño vía `TournamentRepository.findByMatchId()`. El cliente
   (equipo/juez) no necesita conocer el `tournamentId` para actuar sobre un
   match.

4. **Patrón `rehydrate()` en las entidades.** `Match`, `Submission`,
   `Team`, `Tournament` tienen un constructor normal (valida transiciones
   de negocio) y un `static rehydrate()` separado (reconstruye un estado ya
   válido desde persistencia, SIN re-ejecutar la máquina de estados). Si
   agregas un campo mutable nuevo a una entidad, actualiza ambos.

5. **Timer server-side, nunca client-side.** `MatchTimerService` corre un
   `setInterval` por match activo y hace broadcast vía `TournamentEventBus`
   (Observer). Ningún cliente calcula su propio countdown — evita drift de
   reloj entre dispositivos.

6. **Reject no reinicia el timer.** Si el juez rechaza una submission, el
   match vuelve a `ACTIVE` pero el timer sigue corriendo desde su inicio
   original — no hay tiempo extra por un rechazo.

## Testing
44 tests, todos pasando (`npm test`). Incluye:
- Unitarios de dominio (máquina de estados, bracket, clasificatoria)
- Integración real contra SQLite (no mocks) en `persistence.spec.ts`
- E2E de API con `supertest` en `api.e2e.spec.ts`
- E2E de WebSockets con clientes reales de `socket.io-client` en
  `websockets.e2e.spec.ts`

Los casos de uso se prueban con fakes en memoria (`test/fakes/`), no contra
SQLite real — aísla bugs de orquestación de bugs de mapeo SQL.

**Regla no negociable: cualquier cambio de código debe mantener `npm test`
en verde antes de darse por terminado.**

## Estado actual / pendiente
- ✅ Dominio, persistencia, casos de uso, REST API, WebSockets, Swagger
  (`/docs`), CORS habilitado.
- ⏳ Deploy a Render (backend) — no hecho todavía.
- ⏳ UI de clasificatoria en el panel del juez del frontend ya existe,
  pero el flujo completo aún no se ha probado en producción/red real de
  estudiantes.
