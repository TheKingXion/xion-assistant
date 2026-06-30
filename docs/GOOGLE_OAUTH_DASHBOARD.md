# Google OAuth desde Dashboard

Guia directa para llenar la pantalla de Google Cloud OAuth.

Dominio real usado:

```text
exiliadosrpv2.uk
```

Rutas oficiales Xion Assistant:

```text
Web: https://assistant.xion.exiliadosrpv2.uk
API: https://api.asst.xion.exiliadosrpv2.uk
```

Antes de probar OAuth, la API debe resolver por DNS. Si esto falla:

```powershell
curl https://api.asst.xion.exiliadosrpv2.uk/api/health
```

con:

```text
curl: (6) Could not resolve host
```

falta configurar el custom domain del Worker en Cloudflare.

## 1. Crear dominio del Worker API

En Cloudflare:

1. Ir a `Workers & Pages`.
2. Entrar a `xion-assistant-api`.
3. Abrir `Settings`.
4. Abrir `Domains & Routes`.
5. Click `Add custom domain`.
6. Poner:

```text
api.asst.xion.exiliadosrpv2.uk
```

7. Guardar.
8. Esperar DNS/SSL activo.
9. Probar:

```powershell
curl https://api.asst.xion.exiliadosrpv2.uk/api/health
```

Debe responder JSON con `ok: true`.

## 2. Crear dominio de Pages Web

Haz esto cuando ya tengas Pages `xion-assistant` creado.

En Cloudflare:

1. Ir a `Workers & Pages`.
2. Entrar a Pages `xion-assistant`.
3. Abrir `Custom domains`.
4. Click `Set up a custom domain`.
5. Poner:

```text
assistant.xion.exiliadosrpv2.uk
```

6. Guardar.
7. Esperar DNS/SSL activo.

## 3. Google OAuth client

En Google Cloud Console:

1. Ir a `APIs & Services`.
2. Abrir `Credentials`.
3. Click `Create credentials`.
4. Elegir `OAuth client ID`.
5. Tipo:

```text
Web application
```

6. Nombre recomendado:

```text
Xion Assistant Web
```

## 4. Origenes autorizados de JavaScript

En la seccion `Origenes autorizados de JavaScript`, agregar:

```text
https://assistant.xion.exiliadosrpv2.uk
```

Opcional para desarrollo local:

```text
http://localhost:5173
http://localhost:5174
```

No agregues path aqui. Solo protocolo + dominio + puerto si aplica.

Correcto:

```text
https://assistant.xion.exiliadosrpv2.uk
```

Incorrecto:

```text
https://assistant.xion.exiliadosrpv2.uk/login
```

## 5. URIs de redireccionamiento autorizados

En la seccion `URIs de redireccionamiento autorizados`, agregar:

```text
https://api.asst.xion.exiliadosrpv2.uk/api/oauth/google/callback
```

Opcional para desarrollo local:

```text
http://localhost:8787/api/oauth/google/callback
```

Este valor debe coincidir con el backend. No cambia por usuario.

## 6. Crear credenciales

Click `Crear`.

Google devuelve:

```text
Client ID
Client secret
```

Guarda esos valores. No los pongas en el frontend.

## 7. Poner credenciales en Cloudflare Worker

En Cloudflare:

1. Ir a `Workers & Pages`.
2. Entrar a `xion-assistant-api`.
3. Abrir `Settings`.
4. Abrir `Variables and Secrets`.
5. Agregar como secrets:

```env
GOOGLE_CLIENT_ID=tu_client_id_de_google
GOOGLE_CLIENT_SECRET=tu_client_secret_de_google
```

6. Confirmar que existan estas variables:

```env
PUBLIC_WEB_URL=https://assistant.xion.exiliadosrpv2.uk
PUBLIC_API_URL=https://api.asst.xion.exiliadosrpv2.uk
```

7. Guardar.
8. Ir a `Deployments`.
9. Click `Retry deployment` o hacer nuevo push.

## 8. Probar inicio OAuth

Necesitas estar logueado en Xion Assistant y llamar el endpoint con Bearer token.

Ejemplo:

```powershell
curl "https://api.asst.xion.exiliadosrpv2.uk/api/oauth/google/start" `
  -H "Authorization: Bearer TU_TOKEN_DE_XION"
```

Debe devolver una URL de Google.

## 9. Checklist

- Worker custom domain `api.asst.xion.exiliadosrpv2.uk` activo.
- `curl https://api.asst.xion.exiliadosrpv2.uk/api/health` responde.
- Pages domain `assistant.xion.exiliadosrpv2.uk` activo.
- Google OAuth client tipo `Web application`.
- JavaScript origin agregado: `https://assistant.xion.exiliadosrpv2.uk`.
- Redirect URI agregado: `https://api.asst.xion.exiliadosrpv2.uk/api/oauth/google/callback`.
- `GOOGLE_CLIENT_ID` guardado como secret en Worker.
- `GOOGLE_CLIENT_SECRET` guardado como secret en Worker.
- `PUBLIC_WEB_URL` apunta a web real.
- `PUBLIC_API_URL` apunta a API real.
- Worker redeployado despues de cambiar secrets.
