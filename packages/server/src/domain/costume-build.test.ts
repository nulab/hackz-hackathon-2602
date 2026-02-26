import { describe, expect, test } from "bun:test";
import { validateBuildOwnership } from "./costume-build";

describe("validateBuildOwnership", () => {
  test("全スロット所持 → 空配列", () => {
    const owned = new Set(["face-1", "upper-1", "lower-1", "shoes-1"]);
    const result = validateBuildOwnership(["face-1", "upper-1", "lower-1", "shoes-1"], owned);
    expect(result).toEqual([]);
  });

  test("undefined スロットはスキップ", () => {
    const owned = new Set(["face-1"]);
    const result = validateBuildOwnership([undefined, "face-1", undefined, undefined], owned);
    expect(result).toEqual([]);
  });

  test("未所持スロットがエラーリストに含まれる", () => {
    const owned = new Set(["face-1", "lower-1"]);
    const result = validateBuildOwnership(["face-1", "upper-999", "lower-1", "shoes-999"], owned);
    expect(result).toEqual(["upper-999", "shoes-999"]);
  });

  test("全スロット空 → 空配列", () => {
    const owned = new Set<string>();
    const result = validateBuildOwnership([undefined, undefined, undefined, undefined], owned);
    expect(result).toEqual([]);
  });

  test("全スロット未所持 → 全IDがリストに含まれる", () => {
    const owned = new Set<string>();
    const result = validateBuildOwnership(["a", "b", "c", "d"], owned);
    expect(result).toEqual(["a", "b", "c", "d"]);
  });
});
