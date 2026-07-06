# Configuración local — Torneo TGA

Ahora son **dos repos independientes**:

- `tournament-domain` (este repo): API + WebSocket. Puerto 3000.
- `tournament-frontend`: React + Vite. Puerto 5173.

Corren en terminales separadas.

## 1. Backend

```bash
cd tournament-domain
npm install
npm run dev
```

Verifica que levantó: `http://localhost:3000/docs` debe mostrar Swagger.

## 2. Frontend

```bash
cd tournament-frontend
cp .env.example .env
npm install
npm run dev
```

Abre `http://localhost:5173`.

## 3. Registrar equipos y crear el torneo

Usa Swagger (`http://localhost:3000/docs`) o `curl`:

```bash
curl -X POST http://localhost:3000/teams \
  -H "Content-Type: application/json" \
  -d '{"name":"Equipo A","memberNames":["Ana","Luis"]}'
```

Repite para cada equipo, guardando los `id` que devuelve. Luego:

```bash
curl -X POST http://localhost:3000/tournaments \
  -H "Content-Type: application/json" \
  -d '{"name":"Torneo de Prueba"}'
```

Guarda el `id` del torneo, y arráncalo:

```bash
curl -X POST http://localhost:3000/tournaments/TOURNAMENT_ID/start \
  -H "Content-Type: application/json" \
  -d '{
    "teamIds": ["id1","id2","id3","id4","id5","id6","id7","id8"],
    "caseTitle": "Bono de vendedores",
    "caseDescription": "Diseñar el ciclo para calcular el bono de 20 vendedores según sus ventas",
    "timerDurationSeconds": 300
  }'
```

- Potencia de 2 (4, 8, 16) → arranca el bracket directo.
- Cualquier otro número → arranca la clasificatoria.

## 4. Abrir las pantallas (ya en el frontend, puerto 5173)

- **Juez**: `http://localhost:5173/judge/TOURNAMENT_ID`
- **Proyector**: `http://localhost:5173/viewer/TOURNAMENT_ID`
- **Equipos**: comparte **un solo link** con toda la clase —
  `http://localhost:5173/team/TOURNAMENT_ID` — cada equipo se auto-registra
  ahí y la app los redirige sola a donde les toque (clasificatoria, su
  match activo, o pantalla de espera/eliminación).

No necesitas repartir un link distinto por equipo ni por match: el portal
de equipo resuelve eso automáticamente.

## 5. Probar desde varios dispositivos en la misma red WiFi

1. IP local de tu PC: `ipconfig` en Windows (busca "Dirección IPv4").
2. En **ambos** `.env`/config, reemplaza `localhost` por esa IP:
   - Frontend: `VITE_API_URL=http://TU_IP:3000` en `tournament-frontend/.env`
   - Comparte los links con `http://TU_IP:5173/...` en vez de `localhost`
3. Verifica que el firewall de Windows permita el puerto 3000 y el 5173.
4. Los celulares deben estar en la misma red WiFi que tu PC.

## Notas

- `node:sqlite` requiere Node **22.5+** (mejor si usas la LTS más reciente,
  algunas versiones intermedias de la rama 22.x aún no lo traían). Si ves
  `Error: No such built-in module: node:sqlite`, actualiza Node.
- Si reinicias el backend, el estado persiste en `tournament.db`. Bórralo
  si quieres empezar de cero.
- CORS está habilitado con `origin: '*'` para desarrollo. En producción,
  restringe esto al dominio real de tu frontend desplegado.
