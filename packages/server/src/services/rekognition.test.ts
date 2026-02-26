import { describe, expect, test } from "bun:test";
import { detectFaceBoundingBox } from "./rekognition";

describe("rekognition service", () => {
  test("detectFaceBoundingBox is exported as a function", () => {
    expect(typeof detectFaceBoundingBox).toBe("function");
  });
});
