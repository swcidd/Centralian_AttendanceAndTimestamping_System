import { describe, it, expect } from "vitest";
import { pipe, compose } from "./composition";

const addOne = (n: number) => n + 1;
const double = (n: number) => n * 2;
const toLabel = (n: number) => `n=${n}`;
const parseIntLen = (s: string) => s.length;

describe("pipe", () => {
  it("threads a single function (arity 2)", () => {
    expect(pipe(1, addOne)).toBe(2);
  });

  it("executes functions left-to-right (arity 3)", () => {
    // addOne first, then double: (1 + 1) * 2 = 4, not 1 + (1 * 2) = 3.
    expect(pipe(1, addOne, double)).toBe(4);
  });

  it("executes functions left-to-right (arity 4)", () => {
    expect(pipe(1, addOne, double, addOne)).toBe(5);
  });

  it("handles more than four functions via the variadic fallback", () => {
    const logs: string[] = [];
    const record = (tag: string) => (value: unknown) => {
      logs.push(`${tag}:${String(value)}`);
      return value;
    };
    const result = pipe(0, record("a"), record("b"), record("c"), record("d"), record("e"));
    expect(result).toBe(0);
    expect(logs).toEqual(["a:0", "b:0", "c:0", "d:0", "e:0"]);
  });

  it("lets the pipeline change types across stages", () => {
    // number -> number -> string -> number: proves overloads compose
    // heterogeneous stages and the final type is number.
    const result = pipe(1, double, toLabel, parseIntLen);
    expect(result).toBe(3); // double(1) -> "n=2" -> "n=2".length === 3
  });

  it("returns the initial value when no functions are given", () => {
    expect(pipe(42)).toBe(42);
  });
});

describe("compose", () => {
  it("executes right-to-left", () => {
    // compose(double, addOne)(1) === double(addOne(1)) === 4
    const doubleAfterAddOne = compose(double, addOne);
    expect(doubleAfterAddOne(1)).toBe(4);
  });

  it("is the reverse ordering of pipe", () => {
    const composed = compose(double, addOne);
    expect(composed(1)).toBe(pipe(1, addOne, double));
  });
});