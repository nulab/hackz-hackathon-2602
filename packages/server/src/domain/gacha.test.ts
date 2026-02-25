import { describe, expect, test } from "bun:test";
import { pullGacha } from "./gacha";
import { GACHA_RATES } from "@hackz/shared";

describe("pullGacha", () => {
  test("random=0 は normal を返す", () => {
    const result = pullGacha(0);
    expect(result.rarity).toBe("normal");
  });

  test("random=0.5 は normal を返す（累積 0.6 以内）", () => {
    const result = pullGacha(0.5);
    expect(result.rarity).toBe("normal");
  });

  test("random=0.6 は normal の境界値", () => {
    const result = pullGacha(0.6);
    expect(result.rarity).toBe("normal");
  });

  test("random=0.61 は rare を返す", () => {
    const result = pullGacha(0.61);
    expect(result.rarity).toBe("rare");
  });

  test("random=0.85 は rare の境界値", () => {
    const result = pullGacha(0.85);
    expect(result.rarity).toBe("rare");
  });

  test("random=0.86 は superRare を返す", () => {
    const result = pullGacha(0.86);
    expect(result.rarity).toBe("superRare");
  });

  test("random=0.97 は superRare の境界値", () => {
    const result = pullGacha(0.97);
    expect(result.rarity).toBe("superRare");
  });

  test("random=0.98 は ultraRare を返す", () => {
    const result = pullGacha(0.98);
    expect(result.rarity).toBe("ultraRare");
  });

  test("random=0.999 は ultraRare を返す", () => {
    const result = pullGacha(0.999);
    expect(result.rarity).toBe("ultraRare");
  });

  test("引数なしでも有効なレアリティを返す", () => {
    const validRarities = Object.keys(GACHA_RATES);
    const result = pullGacha();
    expect(validRarities).toContain(result.rarity);
  });

  test("全確率帯を統計的に検証する（1000回試行）", () => {
    const counts: Record<string, number> = {};
    const trials = 1000;

    for (let i = 0; i < trials; i++) {
      const result = pullGacha(i / trials);
      counts[result.rarity] = (counts[result.rarity] ?? 0) + 1;
    }

    // 各レアリティが期待される割合に近いことを確認（±5%の許容誤差）
    for (const [rarity, rate] of Object.entries(GACHA_RATES)) {
      const actual = (counts[rarity] ?? 0) / trials;
      expect(Math.abs(actual - rate)).toBeLessThan(0.05);
    }
  });
});
