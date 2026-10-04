// Left-to-right function composition helpers for the
// tap -> validate -> dedupe -> timestamp -> log pipeline.

export function pipe<A, B>(a: A, ab: (a: A) => B): B;
export function pipe<A, B, C>(a: A, ab: (a: A) => B, bc: (b: B) => C): C;
export function pipe<A, B, C, D>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D
): D;
// Variadic fallback matching the runtime implementation: the specific
// overloads above keep 1-3 stage pipelines fully typed; anything longer
// (or a bare value) still type-checks through this signature. The
// `(x: never) => unknown` fn type is the widest that still accepts
// heterogeneous stage functions under strictFunctionTypes.
export function pipe<A, R = A>(a: A, ...fns: Array<(x: never) => unknown>): R;
export function pipe(a: unknown, ...fns: Array<(x: never) => unknown>) {
  return fns.reduce((acc, fn) => fn(acc as never), a);
}

export function compose<A, B, C>(
  bc: (b: B) => C,
  ab: (a: A) => B
): (a: A) => C {
  return (a) => bc(ab(a));
}
