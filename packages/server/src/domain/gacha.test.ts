import { describe, expect, test } from "bun:test";
import { pullGacha, selectCostume } from "./gacha";
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

describe("selectCostume", () => {
  const costumes = [
    { id: "common", weight: 600 },
    { id: "rare", weight: 250 },
    { id: "super", weight: 120 },
    { id: "ultra", weight: 30 },
  ];

  test("random=0 は最初のアイテムを返す", () => {
    expect(selectCostume(costumes, 0).id).toBe("common");
  });

  test("random=0.59 は common 範囲内", () => {
    expect(selectCostume(costumes, 0.59).id).toBe("common");
  });

  test("random=0.6 は common の境界値", () => {
    expect(selectCostume(costumes, 0.6).id).toBe("common");
  });

  test("random=0.61 は rare を返す", () => {
    expect(selectCostume(costumes, 0.61).id).toBe("rare");
  });

  test("random=0.85 は rare の境界値", () => {
    expect(selectCostume(costumes, 0.85).id).toBe("rare");
  });

  test("random=0.86 は super を返す", () => {
    expect(selectCostume(costumes, 0.86).id).toBe("super");
  });

  test("random=0.97 は super の境界値", () => {
    expect(selectCostume(costumes, 0.97).id).toBe("super");
  });

  test("random=0.98 は ultra を返す", () => {
    expect(selectCostume(costumes, 0.98).id).toBe("ultra");
  });

  test("random=0.999 は ultra を返す", () => {
    expect(selectCostume(costumes, 0.999).id).toBe("ultra");
  });

  test("要素が1つでもその要素を返す", () => {
    expect(selectCostume([{ id: "only", weight: 100 }], 0.5).id).toBe("only");
  });

  test("全 weight が均等なら均等に分布する", () => {
    const equal = [
      { id: "a", weight: 100 },
      { id: "b", weight: 100 },
      { id: "c", weight: 100 },
      { id: "d", weight: 100 },
    ];
    expect(selectCostume(equal, 0.1).id).toBe("a");
    expect(selectCostume(equal, 0.3).id).toBe("b");
    expect(selectCostume(equal, 0.6).id).toBe("c");
    expect(selectCostume(equal, 0.9).id).toBe("d");
  });
});
