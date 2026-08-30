export function changedRecords<T extends { id: string }>(current: T[], next: T[]) {
  const previous = new Map(current.map((record) => [record.id, record]));
  return next.filter((record) => previous.get(record.id) !== record);
}

export function mergeRecords<T extends { id: string }>(current: T[], incoming: T[]) {
  const merged = new Map(current.map((record) => [record.id, record]));
  incoming.forEach((record) => merged.set(record.id, record));
  return Array.from(merged.values());
}
