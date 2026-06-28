# Assistant Engine

`v0.10.0` adds Command Router before AI Gateway.

## Flow

1. Receive user message.
2. Validate session and derive `user_id`.
3. Try private shortcuts, then system Command Registry.
4. Resolve parameters and confidence.
5. Execute safe command, request missing data, or create confirmation.
6. Use AI Gateway only when deterministic confidence is low.
7. Resolve contact or memory by `user_id`.
8. Create plan, return text and optionally TTS.

Every optimized command persists action and plan. AI fallback records zero saved tokens. Learning proposals become active only after user confirmation.

## Plans

Plans have title, risk level and ordered steps. Sensitive steps are `pending_confirmation`.

## Tools

Initial tool registry includes name, description, scopes, auth, confirmation flag and risk level. Execution functions remain connector-specific and pending.

## Spoken Response

If `spokenResponse=true`, engine calls TTS gateway.

## Action Logging

High-risk message actions, confirmations, assistant plans and plan steps persist through the repository. Real connector execution is still pending.
