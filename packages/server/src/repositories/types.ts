import type { CostumeCategory, Rank, Rarity, SessionStatus } from "@hackz/shared";

/** 全エンティティ共通: 楽観的ロック用バージョンフィールド */
export type Versioned<T> = T & { version: number };

// ── User ──

export type User = {
  id: string;
  nfcId: string;
  name: string;
  token: string;
  photoUrl?: string;
  equippedBuildId?: string;
  totalScore: number;
  createdAt: string;
};

export type UserRepository = {
  findById(id: string): Promise<Versioned<User> | null>;
  findByNfcId(nfcId: string): Promise<Versioned<User> | null>;
  create(user: User): Promise<Versioned<User>>;
  /** 楽観的ロック付き更新: version が一致しなければ例外 */
  update(user: Versioned<User>): Promise<Versioned<User>>;
};

// ── Costume ──

export type Costume = {
  id: string;
  name: string;
  rarity: Rarity;
  category: CostumeCategory;
  imageUrl: string;
  description: string;
  weight: number;
};

export type CostumeRepository = {
  findById(id: string): Promise<Versioned<Costume> | null>;
  findByRarity(rarity: Rarity): Promise<Versioned<Costume>[]>;
  findAll(): Promise<Versioned<Costume>[]>;
  create(costume: Costume): Promise<Versioned<Costume>>;
};

// ── UserCostume ──

export type UserCostume = {
  userId: string;
  costumeId: string;
  acquiredAt: string;
  count: number;
};

export type UserCostumeRepository = {
  findByUserId(userId: string): Promise<UserCostume[]>;
  find(userId: string, costumeId: string): Promise<UserCostume | null>;
  /** ガチャで獲得: 新規なら作成、既所持なら count をインクリメント */
  acquire(userId: string, costumeId: string): Promise<{ item: UserCostume; isNew: boolean }>;
};

// ── CostumeBuild ──

export type CostumeBuild = {
  userId: string;
  buildId: string;
  name: string;
  faceId?: string;
  upperId?: string;
  lowerId?: string;
  shoesId?: string;
  isDefault: boolean;
  createdAt: string;
};

export type CostumeBuildRepository = {
  findByUserId(userId: string): Promise<Versioned<CostumeBuild>[]>;
  find(userId: string, buildId: string): Promise<Versioned<CostumeBuild> | null>;
  create(build: CostumeBuild): Promise<Versioned<CostumeBuild>>;
  update(build: Versioned<CostumeBuild>): Promise<Versioned<CostumeBuild>>;
  delete(userId: string, buildId: string): Promise<void>;
};

// ── Session ──

export type Session = {
  id: string;
  userId: string;
  status: SessionStatus;
  buildId: string;
  photoUrl: string;
  progress: number;
  videoUrl?: string;
  score?: number;
  rank?: Rank;
  createdAt: string;
};

export type SessionRepository = {
  findById(id: string): Promise<Versioned<Session> | null>;
  findByUserId(userId: string): Promise<Versioned<Session>[]>;
  create(session: Session): Promise<Versioned<Session>>;
  update(session: Versioned<Session>): Promise<Versioned<Session>>;
};

// ── 楽観的ロック失敗エラー ──

export class OptimisticLockError extends Error {
  constructor(entity: string, id: string) {
    super(`Optimistic lock conflict on ${entity} (id=${id}): item was modified by another request`);
    this.name = "OptimisticLockError";
  }
}
