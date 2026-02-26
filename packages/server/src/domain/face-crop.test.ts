import { describe, expect, test } from "bun:test";
import { computeCropRegion } from "./face-crop";

describe("computeCropRegion", () => {
  test("adds padding around bounding box and returns square crop", () => {
    const result = computeCropRegion({ left: 0.4, top: 0.4, width: 0.2, height: 0.2 }, 1000, 1000);
    // Face is 200x200, padding = 200 * 0.4 = 80
    // cropSize = 200 + 80*2 = 360
    // centerX = 400 + 100 = 500, centerY = 400 + 100 = 500
    // cropX = 500 - 180 = 320, cropY = 500 - 180 = 320
    expect(result.x).toBe(320);
    expect(result.y).toBe(320);
    expect(result.size).toBe(360);
  });

  test("clamps crop region to image bounds", () => {
    const result = computeCropRegion({ left: 0, top: 0, width: 0.3, height: 0.3 }, 100, 100);
    expect(result.x).toBeGreaterThanOrEqual(0);
    expect(result.y).toBeGreaterThanOrEqual(0);
    expect(result.x + result.size).toBeLessThanOrEqual(100);
    expect(result.y + result.size).toBeLessThanOrEqual(100);
  });

  test("returns center crop when bounding box is null (fallback)", () => {
    const result = computeCropRegion(null, 1000, 800);
    // Fallback: 70% of min(1000,800) = 560
    expect(result.size).toBe(560);
    // Centered: x = (1000 - 560) / 2 = 220
    expect(result.x).toBe(220);
  });
});
