import { randomBytes } from "node:crypto";

type Room = {
  roomId: string;
  createdBy: string;
  adminConnected: boolean;
  createdAt: number;
};

const rooms = new Map<string, Room>();

export const generateRoomId = (): string => randomBytes(4).toString("hex");

export const createRoom = (userId: string): Room => {
  const roomId = generateRoomId();
  const room: Room = {
    roomId,
    createdBy: userId,
    adminConnected: false,
    createdAt: Date.now(),
  };
  rooms.set(roomId, room);
  return room;
};

export const getRoom = (roomId: string): Room | undefined => rooms.get(roomId);

export const markAdminConnected = (roomId: string): boolean => {
  const room = rooms.get(roomId);
  if (!room) {
    return false;
  }
  if (room.adminConnected) {
    return false;
  } // 1:1 制限
  room.adminConnected = true;
  return true;
};

export const deleteRoom = (roomId: string): boolean => rooms.delete(roomId);
