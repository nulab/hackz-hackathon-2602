import { EventEmitter } from "node:events";
import type { ProjectorEvent, SessionEvent, SignalingEvent } from "@hackz/shared";

export const ee = new EventEmitter();
ee.setMaxListeners(100);

export const emitProjectorEvent = (event: ProjectorEvent) => {
  ee.emit("projector", event);
};

export const emitSessionEvent = (sessionId: string, event: SessionEvent) => {
  ee.emit(`session:${sessionId}`, event);
};

export const emitSignalToProjector = (roomId: string, event: SignalingEvent) => {
  ee.emit(`signal:${roomId}:projector`, event);
};

export const emitSignalToAdmin = (roomId: string, event: SignalingEvent) => {
  ee.emit(`signal:${roomId}:admin`, event);
};
