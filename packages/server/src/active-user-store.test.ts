import { describe, test, expect, beforeEach } from "bun:test";
import { ActiveUserStore } from "./active-user-store";

describe("ActiveUserStore", () => {
  let store: ActiveUserStore;

  beforeEach(() => {
    store = new ActiveUserStore();
  });

  test("get returns null initially", () => {
    expect(store.get()).toBeNull();
  });

  test("set and get returns the active user", () => {
    store.set("user-1", "nfc-abc");
    const result = store.get();
    expect(result).not.toBeNull();
    expect(result!.userId).toBe("user-1");
    expect(result!.nfcId).toBe("nfc-abc");
    expect(result!.updatedAt).toBeGreaterThan(0);
  });

  test("set overwrites the previous user", () => {
    store.set("user-1", "nfc-abc");
    store.set("user-2", "nfc-def");
    expect(store.get()!.userId).toBe("user-2");
  });

  test("clear resets to null", () => {
    store.set("user-1", "nfc-abc");
    store.clear();
    expect(store.get()).toBeNull();
  });
});
