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

## Alias Examples

- `mi esposa` -> `Camila`
- `mi hermano` -> `Diego`
- `Clientes` -> `Gmail`
- `voice_preference` -> `xion_voice_1`
