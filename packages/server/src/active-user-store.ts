type ActiveUser = {
  userId: string;
  nfcId: string;
  updatedAt: number;
};

export class ActiveUserStore {
  private activeUser: ActiveUser | null = null;

  set(userId: string, nfcId: string): void {
    this.activeUser = { userId, nfcId, updatedAt: Date.now() };
  }

  get(): ActiveUser | null {
    return this.activeUser;
  }

  clear(): void {
    this.activeUser = null;
  }
}

export const activeUserStore = new ActiveUserStore();
