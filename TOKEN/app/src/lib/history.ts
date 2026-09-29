import type { TextKind } from "../engine/types";
import type { BatchRowResult } from "../workers/batch.worker";

export interface BatchRow extends BatchRowResult {
  text: string;
}

export interface BatchRecord {
  id: string;
  name: string;
  created: string;
  kind: TextKind;
  rows: BatchRow[];
}

const KEY = "tep.history";
const MAX_BATCHES = 5;
const MAX_TEXT = 280; // keep history small; full text stays in the downloaded CSV

export function loadHistory(): BatchRecord[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as BatchRecord[];
  } catch {
    return [];
  }
}

/** Newest first, at most five; drops the oldest batches if browser storage is full. */
export function saveBatch(record: BatchRecord): BatchRecord[] {
  const slim = { ...record, rows: record.rows.map((r) => ({ ...r, text: r.text.slice(0, MAX_TEXT) })) };
  let list = [slim, ...loadHistory().filter((b) => b.id !== record.id)].slice(0, MAX_BATCHES);
  while (list.length) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
      return list;
    } catch {
      list = list.slice(0, -1);
    }
  }
  return [];
}

export function deleteBatch(id: string): BatchRecord[] {
  const list = loadHistory().filter((b) => b.id !== id);
  localStorage.setItem(KEY, JSON.stringify(list));
  return list;
}
