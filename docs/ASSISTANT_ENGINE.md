# Assistant Engine

`v0.4.0` includes a deterministic AI Gateway-backed engine for testing foundation behavior.

## Flow

1. Receive user message.
2. Classify intent through AI Gateway.
3. Resolve contact or memory by `user_id`.
4. Create plan.
5. Assign risk.
6. Require confirmation for high risk action.
7. Return text.
8. Optionally return TTS mock.

## Plans

Plans have title, risk level and ordered steps. Sensitive steps are `pending_confirmation`.

## Tools

Initial tool registry includes name, description, scopes, auth, confirmation flag and risk level. Execution functions remain connector-specific and pending.

## Spoken Response

If `spokenResponse=true`, engine calls TTS gateway.

## Action Logging

High-risk message actions, confirmations, assistant plans and plan steps persist through the repository. Real connector execution is still pending.
