import { describe, expect, test } from "bun:test";
import { GACHA_RATES } from "./constants";

describe("GACHA_RATES", () => {
  test("probabilities sum to 1", () => {
    const sum = Object.values(GACHA_RATES).reduce((acc, rate) => acc + rate, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(Number.EPSILON);
  });
});
