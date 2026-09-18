import type { Prisma } from '@/generated/prisma/client';

/**
 * Type-safe helpers for casting between Prisma JSON fields and application types.
 *
 * Prisma stores JSON columns as `InputJsonValue` / `OutputJsonValue` (`JsonValue`),
 * but the application code works with concrete types like `Source[]`, `ExperimentVariant[]`, etc.
 *
 * These helpers centralise every `as unknown as` cast so that:
 *  1. The intent is explicit (read vs write).
 *  2. Lint suppressions live in one place.
 *  3. If Prisma's JSON types change, only this file needs updating.
 */

// -- Reading (Prisma JSON output -> application type) --------------------------

/** Safely cast a Prisma JSON output value to a typed value, with a fallback. */
export function fromJson<T>(value: Prisma.JsonValue | null | undefined, fallback: T): T;
export function fromJson<T>(
  value: Prisma.JsonValue | null | undefined,
  fallback: T | null
): T | null;
export function fromJson<T>(
  value: Prisma.JsonValue | null | undefined,
  fallback: T | null
): T | null {
  if (value === null || value === undefined) return fallback;
  return value as T;
}

/** Safely cast a nullable Prisma JSON output value to a typed value, returning `undefined` when null. */
export function fromJsonOptional<T>(value: Prisma.JsonValue | null | undefined): T | undefined {
  if (value === null || value === undefined) return undefined;
  return value as T;
}

// -- Writing (application type -> Prisma JSON input) ---------------------------

/** Safely cast a typed value to Prisma JSON input. */
export function toJson<T>(value: T): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

/** Safely cast a typed value (or undefined) to Prisma JSON input, defaulting to an empty object. */
export function toJsonOrEmpty<T extends Record<string, unknown>>(
  value: T | null | undefined
): Prisma.InputJsonValue {
  return (value ?? {}) as unknown as Prisma.InputJsonValue;
}
