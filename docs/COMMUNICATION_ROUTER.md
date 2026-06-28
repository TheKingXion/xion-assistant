# Communication Router

Planned module. `v0.0.1` only models safe confirmation behavior for `communication.send_message`.

## Responsibilities

- Resolve intent.
- Resolve recipient alias.
- Resolve contact.
- Choose channel.
- Prepare message.
- Require confirmation.
- Execute only with approved action.

## Limits

No unofficial WhatsApp/Instagram/TikTok APIs. Use OAuth, official APIs, deeplinks or intents only.

## Confirmation

Sending messages is high risk. It must remain pending until user confirms.
