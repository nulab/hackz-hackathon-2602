/**
 * ビルドに設定されたコスチュームの所持判定。
 * 未所持のコスチュームIDリストを返す（空配列 = 全て所持済み）。
 */
export const validateBuildOwnership = (
  slotIds: (string | undefined)[],
  ownedCostumeIds: Set<string>,
): string[] => {
  const unowned: string[] = [];
  for (const id of slotIds) {
    if (id !== undefined && !ownedCostumeIds.has(id)) {
      unowned.push(id);
    }
  }
  return unowned;
};
