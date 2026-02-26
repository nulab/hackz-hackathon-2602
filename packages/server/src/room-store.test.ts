import { describe, test, expect, beforeEach } from "bun:test";
import { RoomStore } from "./room-store";

describe("RoomStore", () => {
  let store: RoomStore;

  beforeEach(() => {
    store = new RoomStore();
  });

  test("createRoom returns a uuid roomId", () => {
    const roomId = store.createRoom();
    expect(roomId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  test("joinRoom succeeds for existing room", () => {
    const roomId = store.createRoom();
    expect(store.joinRoom(roomId)).toBe(true);
  });

  test("joinRoom fails for non-existent room", () => {
    expect(store.joinRoom("00000000-0000-0000-0000-000000000000")).toBe(false);
  });

  test("send and poll messages", () => {
    const roomId = store.createRoom();
    const msgId = store.send(roomId, "upstream", {
      type: "NFC_SCANNED",
      payload: { nfcId: "abc" },
    });
    expect(msgId).toBe(1);

    const result = store.poll(roomId, "upstream");
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].type).toBe("NFC_SCANNED");
    expect(result.lastId).toBe(1);
  });

  test("poll with afterId returns only new messages", () => {
    const roomId = store.createRoom();
    store.send(roomId, "upstream", { type: "A", payload: {} });
    store.send(roomId, "upstream", { type: "B", payload: {} });

    const result = store.poll(roomId, "upstream", 1);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].type).toBe("B");
  });

  test("poll returns empty for unknown room", () => {
    const result = store.poll("00000000-0000-0000-0000-000000000000", "upstream");
    expect(result.messages).toHaveLength(0);
    expect(result.lastId).toBe(0);
  });

  test("broadcast sends to all rooms projector channel", () => {
    const r1 = store.createRoom();
    const r2 = store.createRoom();
    store.broadcast("projector", { type: "gacha:result", payload: { costumeId: "x" } });

    expect(store.poll(r1, "projector").messages).toHaveLength(1);
    expect(store.poll(r2, "projector").messages).toHaveLength(1);
  });

  test("heartbeat tracks peer activity", () => {
    const roomId = store.createRoom();
    const result = store.heartbeat(roomId, "admin");
    expect(result.peerConnected).toBe(false);

    store.heartbeat(roomId, "projector");
    const result2 = store.heartbeat(roomId, "admin");
    expect(result2.peerConnected).toBe(true);
  });

  test("admin disconnect does not affect peer status (multiple admins supported)", () => {
    const roomId = store.createRoom();
    store.heartbeat(roomId, "admin");
    store.heartbeat(roomId, "projector");

    store.disconnect(roomId, "admin");
    // Admin disconnect is a no-op; adminLastSeen stays intact
    const result = store.heartbeat(roomId, "projector");
    expect(result.peerConnected).toBe(true);
  });

  test("projector disconnect marks projector as disconnected", () => {
    const roomId = store.createRoom();
    store.heartbeat(roomId, "admin");
    store.heartbeat(roomId, "projector");

    store.disconnect(roomId, "projector");
    const result = store.heartbeat(roomId, "admin");
    expect(result.peerConnected).toBe(false);
  });

  test("messages are capped at 100 per channel", () => {
    const roomId = store.createRoom();
    for (let i = 0; i < 110; i++) {
      store.send(roomId, "upstream", { type: "msg", payload: { i } });
    }
    const result = store.poll(roomId, "upstream");
    expect(result.messages).toHaveLength(100);
    expect(result.messages[0].id).toBe(11);
  });

  test("cleanup removes expired rooms", () => {
    const roomId = store.createRoom();
    store._getRoom(roomId)!.lastActivity = Date.now() - 31 * 60 * 1000;
    store.cleanup();
    expect(store.joinRoom(roomId)).toBe(false);
  });
});
