# Memory System

Memory is private by user.

## Table

`assistant_memories` stores:

- `user_id`
- `memory_type`
- `key`
- `value`
- `confirmed`
- `confidence`
- `source`

## Learning

`v0.0.1` supports confirmed memory creation through API. Multi-turn learning dialog is planned.

## Edit/Delete

Create/list exist. Edit/delete/export/clear are pending.

## Isolation

Reads must always filter by `user_id`.

## Memory, aliases and shortcuts

- Memory stores durable facts/preferences.
- Contact aliases map private names to private contacts.
- Command shortcuts map private phrases to intents and structured parameters.

Shortcuts live in `user_command_shortcuts`, not global memory. Matching starts only after authenticated `user_id` is known.

## Alias Examples

- `mi esposa` -> `Camila`
- `mi hermano` -> `Diego`
- `Clientes` -> `Gmail`
- `voice_preference` -> `xion_voice_1`

`v0.3.0` resolves contact aliases from `contact_aliases` first. `assistant_memories` remains fallback for older/general preferences.
