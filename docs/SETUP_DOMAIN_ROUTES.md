# Domain Routes

## Why `assistant.xion.<TU_DOMINIO>`

It isolates public web, private panel, dashboard, downloads and future admin UI from existing generic apps.

## Why `api.asst.xion.<TU_DOMINIO>`

It isolates Worker API from any existing `api.<TU_DOMINIO>` project.

## Avoid Conflicts

Do not use:

- `admin.<TU_DOMINIO>`
- `api.<TU_DOMINIO>`
- `app.<TU_DOMINIO>`

## Cloudflare DNS

Create custom domains through Pages and Workers when possible. If manual DNS is needed:

```text
assistant.xion.<TU_DOMINIO>  CNAME  <pages-project>.pages.dev
api.asst.xion.<TU_DOMINIO>   proxied Worker custom domain
```

## Worker Domain

Do not put placeholder routes in `workers/api/wrangler.toml`. Configure the Worker domain from Cloudflare Dashboard after the real zone exists:

```text
Workers & Pages > xion-assistant-api > Settings > Domains & Routes > Add custom domain
api.asst.xion.<TU_DOMINIO>
```

If `[[routes]]` contains `<TU_DOMINIO>`, `wrangler deploy` fails with `Could not find zone for <TU_DOMINIO>`.

## Pages Domain

Cloudflare Pages project: `xion-assistant`.

Custom domain:

```text
assistant.xion.<TU_DOMINIO>
```

## SSL Validation

Cloudflare should show active universal SSL. Test:

```bash
curl -I https://assistant.xion.<TU_DOMINIO>
curl -I https://api.asst.xion.<TU_DOMINIO>/api/health
```

## Route Tests

```bash
curl --fail https://api.asst.xion.<TU_DOMINIO>/api/health
curl --fail https://assistant.xion.<TU_DOMINIO>
```
