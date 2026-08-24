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
export function pipe(a: unknown, ...fns: Array<(x: unknown) => unknown>) {
  return fns.reduce((acc, fn) => fn(acc), a);
}

export function compose<A, B, C>(
  bc: (b: B) => C,
  ab: (a: A) => B
): (a: A) => C {
  return (a) => bc(ab(a));
}
