import { EventEmitter } from "node:events";
import type { ProjectorEvent, SessionEvent } from "@hackz/shared";

export const ee = new EventEmitter();
ee.setMaxListeners(100);

export const emitProjectorEvent = (event: ProjectorEvent) => {
  ee.emit("projector", event);
};

export const emitSessionEvent = (sessionId: string, event: SessionEvent) => {
  ee.emit(`session:${sessionId}`, event);
};
