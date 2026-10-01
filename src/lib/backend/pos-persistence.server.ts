export type PosPersistenceInput = {
  accessToken: string;
  [key: string]: unknown;
};

export async function persistPosRecordsWithServiceRole(_data: PosPersistenceInput) {
  return { ok: true as const };
}
