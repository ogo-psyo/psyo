export type RecoverableRecord = {
  id: string;
  deletedAt: string | null;
};

export function softDeleteRecord<T extends RecoverableRecord>(record: T, deletedAt: string): T {
  if (!Number.isFinite(Date.parse(deletedAt))) throw new Error('INVALID_DATE');
  return { ...record, deletedAt };
}

export function restoreRecord<T extends RecoverableRecord>(record: T): T {
  return { ...record, deletedAt: null };
}

export function listActiveRecords<T extends RecoverableRecord>(records: T[]): T[] {
  return records.filter((record) => record.deletedAt === null);
}
