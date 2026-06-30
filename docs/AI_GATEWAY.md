# AI Gateway

`v0.11.0` includes an AI Gateway interface with mock and Google Gemini providers.

## Methods

- `generateText()`
- `classifyIntent()`
- `extractEntities()`
- `summarize()`
- `createActionPlan()`

## Providers

- `mock`: local/test fallback.
- `google`: Gemini Interactions API using `AI_API_KEY`.

Provider keys stay server-side in Cloudflare Worker secrets. Frontend never receives `AI_API_KEY`.

Google config used in production Worker:

```env
AI_PROVIDER=google
AI_MODEL=gemini-2.5-flash
AI_SMALL_MODEL=gemini-2.5-flash
```

The Worker calls `https://generativelanguage.googleapis.com/v1beta/interactions` with `x-goog-api-key` and reads `output_text`.

## Endpoints

```text
POST /api/assistant/classify
POST /api/assistant/plan
```

## Usage

Mock gateway returns approximate token counts and zero estimated cost. Google gateway estimates local token counts for now; persistent billing/usage limits remain pending.
