# Assistant Engine

`v0.2.0` includes a small deterministic engine for testing foundation behavior.

## Flow

1. Receive user message.
2. Classify simple intent.
3. Resolve memory by `user_id`.
4. Create plan.
5. Assign risk.
6. Require confirmation for high risk action.
7. Return text.
8. Optionally return TTS mock.

## Plans

Plans have title, risk level and ordered steps. Sensitive steps are `pending_confirmation`.

## Tools

Initial tool contract includes name, description, scopes, auth, confirmation flag, risk level and execute function. Full registry pending.

## Spoken Response

If `spokenResponse=true`, engine calls TTS gateway.

## Action Logging

High-risk message actions, confirmations, assistant plans and plan steps persist through the repository. Real connector execution is still pending.
