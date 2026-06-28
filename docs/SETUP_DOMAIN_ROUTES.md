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

In `workers/api/wrangler.toml`:

```toml
[[routes]]
pattern = "api.asst.xion.<TU_DOMINIO>/*"
zone_name = "<TU_DOMINIO>"
```

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
