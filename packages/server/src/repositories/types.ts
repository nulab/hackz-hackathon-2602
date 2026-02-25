import type { SessionStatus } from "@hackz/shared";

/** 全エンティティ共通: 楽観的ロック用バージョンフィールド */
export type Versioned<T> = T & { version: number };

// ── User ──

export type User = {
  id: string;
  nfcId: string;
  name: string;
  photoUrl?: string;
  equippedCostumeId?: string;
  createdAt: string;
};

export type UserRepository = {
  findById(id: string): Promise<Versioned<User> | null>;
  findByNfcId(nfcId: string): Promise<Versioned<User> | null>;
  create(user: User): Promise<Versioned<User>>;
  /** 楽観的ロック付き更新: version が一致しなければ例外 */
  update(user: Versioned<User>): Promise<Versioned<User>>;
};

// ── Session ──

export type Session = {
  id: string;
  userId: string;
  status: SessionStatus;
  costumeId: string;
  progress: number;
  videoUrl?: string;
  createdAt: string;
};

export type SessionRepository = {
  findById(id: string): Promise<Versioned<Session> | null>;
  findByUserId(userId: string): Promise<Versioned<Session>[]>;
  create(session: Session): Promise<Versioned<Session>>;
  update(session: Versioned<Session>): Promise<Versioned<Session>>;
};

// ── Costume ──

export type Costume = {
  id: string;
  name: string;
  rarity: string;
  imageUrl: string;
  description: string;
};

export type CostumeRepository = {
  findById(id: string): Promise<Versioned<Costume> | null>;
  findByRarity(rarity: string): Promise<Versioned<Costume>[]>;
  findAll(): Promise<Versioned<Costume>[]>;
  create(costume: Costume): Promise<Versioned<Costume>>;
};

// ── 楽観的ロック失敗エラー ──

export class OptimisticLockError extends Error {
  constructor(entity: string, id: string) {
    super(`Optimistic lock conflict on ${entity} (id=${id}): item was modified by another request`);
    this.name = "OptimisticLockError";
  }
}
