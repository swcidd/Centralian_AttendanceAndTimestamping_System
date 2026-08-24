export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export function Ok<T, E = never>(value: T): Result<T, E> {
  return { ok: true, value };
}

export function Err<E, T = never>(error: E): Result<T, E> {
  return { ok: false, error };
}
