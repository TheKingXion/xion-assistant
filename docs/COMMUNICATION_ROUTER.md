# Communication Router

`v0.3.0` includes an initial Communication Router. It resolves contacts by display name or confirmed alias for the current `user_id`, selects the preferred channel, prepares the message, and leaves execution pending confirmation.

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

Confirmed actions still do not call external apps until a real connector exists.
