# Command Registry

Command Registry resuelve ordenes frecuentes con reglas deterministicas antes de usar IA. Reduce latencia, costo y tokens, sin omitir aislamiento ni confirmaciones.

## Flujo

1. Middleware valida token y sesion; `user_id` nunca viene del body.
2. Normaliza minusculas, espacios, signos y acentos.
3. Busca shortcuts confirmados y activos del usuario.
4. Busca patrones estaticos del sistema.
5. Extrae hora, fecha, repeticion, contacto, app, mensaje, consulta, canal y duracion.
6. Calcula confidence: alta `>= 0.90`, media `0.65-0.89`, baja `< 0.65`.
7. Alta: crea accion o instruccion local. Media: requiere confirmar interpretacion. Parametros faltantes: pregunta solo esos datos. Baja: fallback a AI Gateway.
8. Registra resultado y tokens estimados ahorrados por usuario.

## Seguridad y aislamiento

`user_command_shortcuts`, `command_usage_events` y `command_learning_events` tienen `user_id`. Repositorios filtran siempre por propietario. Un ID de shortcut no concede acceso. Comunicacion, cancelaciones ambiguas, eventos y alarmas repetitivas quedan en `pending_confirmation`.

Comandos locales (`alarm.*`, `app.open`) devuelven instrucciones para desktop/mobile. Worker no afirma ejecucion local. Comandos del sistema se definen en TypeScript; D1 no ejecuta regex configurables.

## Shortcuts

```http
POST /api/commands/shortcuts
Authorization: Bearer <TOKEN>
Content-Type: application/json

{"shortcut":"tempranito","intent":"alarm.create","params":{"time":"06:45"}}
```

Usuario A y B pueden guardar mismo texto con parametros distintos. Solo shortcuts confirmados y activos participan.

## Metricas

`command_usage_events` guarda comando, patron, confidence, fallback y `estimated_tokens_saved`. `GET /api/commands/usage` devuelve eventos y totales privados.

## Agregar comando

1. Crear definicion en `workers/api/src/modules/commands/commands/`.
2. Declarar patrones, parametros, riesgo, plataformas y modo local/cloud.
3. Registrarla en `command-registry.ts`.
4. Agregar extraccion especifica si requiere entidades nuevas.
5. Agregar pruebas de match, riesgo, ejecucion y fallback.

## Prueba rapida

```powershell
pnpm test
pnpm typecheck
pnpm build
```

Desde panel: crear cuenta, abrir `Comandos optimizados`, crear `tempranito`, ejecutar `despiertame tempranito` y verificar incremento de tokens ahorrados.
