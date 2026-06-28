# AI Gateway

`v0.4.0` adds an AI Gateway interface with mock provider.

## Methods

- `generateText()`
- `classifyIntent()`
- `extractEntities()`
- `summarize()`
- `createActionPlan()`

## Provider

Current provider: `mock`.

Real providers must keep API keys server-side in Cloudflare secrets. Frontend never receives `AI_API_KEY`.

## Endpoints

```text
POST /api/assistant/classify
POST /api/assistant/plan
```

## Usage

Mock gateway returns approximate token counts and zero estimated cost. Real provider adapter must record usage by `user_id` before production billing.
