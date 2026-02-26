type ActiveUser = {
  userId: string;
  nfcId: string;
  updatedAt: number;
};

export class ActiveUserStore {
  private activeUser: ActiveUser | null = null;
  private clearedExplicitly = false;

  set(userId: string, nfcId: string): void {
    this.activeUser = { userId, nfcId, updatedAt: Date.now() };
    this.clearedExplicitly = false;
  }

  get(): ActiveUser | null {
    return this.activeUser;
  }

  isCleared(): boolean {
    return this.clearedExplicitly;
  }

  clear(): void {
    this.activeUser = null;
    this.clearedExplicitly = true;
  }
}

export const activeUserStore = new ActiveUserStore();
