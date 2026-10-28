import { useEffect, useState } from "react";

/** 与库同名（snake_case），不在前端做任何口径改名。 */
export type Point = {
  id: number;
  drug_id: number;
  organ_norm: string;
  is_tumor: number;
  isotope: string | null;
  time_h: number | null;
  value_num: number;
  value_sd: number | null;
  value_unit: string;
  evidence_grade: string | null;
  doc_pmid: string | null;
  source_kind: string;
  subject_key: string | null;
  species: string | null;
  drug_en?: string | null;
  /** 1 = 有原文片段；0 = 只有 PMID 可追溯（487 条，pk263 新增） */
  has_raw?: number;
};

export type Drug = {
  drug_id: number;
  name_en: string;
  name_zh: string | null;
  drug_type: string | null;
  status: string | null;
  radionuclides_zh: string | null;
  targets_zh: string | null;
  diseases_zh: string | null;
  chelators_zh: string | null;
  linkers_zh: string | null;
  vectors_zh: string | null;
  has_struct: number;
  n_points?: number;
  name_ok?: number;
  /** 剂量学行数（dosimetry.json 中 did == drug_id 的行数） */
  n_dosim?: number;
  /** 是否有靶本比（库存量标记，明细不在 public/data 导出层） */
  has_tbr?: number;
  /** 参考文献条数 */
  n_refs?: number;
};

/** 器官吸收剂量行（public/data/dosimetry.json，1 行 = 1 器官 × 1 单位口径）。
 *  organ 为归一化英文键（可为 null：原文未点名单一器官）；organ_raw 为原文写法。 */
export type DoseRow = {
  did: number;
  drug: string;
  organ: string | null;
  organ_raw: string | null;
  species: string | null;
  iso: string | null;
  v: number;
  u: string;
  model: string | null;
  grade: string;
  src: string;
  raw: string;
};

export type Dist = { k: string; n: number };

export type Stats = {
  total: number;
  drugs: number;
  organs: number;
  tables: number;
  tiers: { l1_has_pmid: number; l2_in_lit: number; l3_oa: number };
  by_grade: Dist[];
  by_source: Dist[];
  by_organ: Dist[];
  by_isotope: Dist[];
  by_species: Dist[];
  /** 剂量学层（pk258 从 FDA 标签补入）· 可选，老 stats.json 没有 */
  dosimetry?: { total: number; drugs: number; organs: number };
  /** 语境过滤前的原始行数（pk263 新增；= 未剔除多药比较句时的 total） */
  raw_total_unfiltered?: number;
  /** 被标记为 comparative_context 的行数（pk263 新增；用于 About 页审计说明） */
  excluded_comparative_context?: number;
  /** 覆盖率 · 用「有数据的药」而不是 drug 表全量，避免误导 */
  coverage?: {
    drugs_total: number;
    drugs_with_biodist: number;
    drugs_with_dosim: number;
    drugs_with_struct: number;
  };
};

export type Meta = {
  version: string;
  db_sha16: string;
  db_bytes: number;
  generated_at: string;
  counts: { biodist: number; drugs: number; tables: number; refs: number };
  files: Record<string, number>;
};

const cache = new Map<string, unknown>();

/** 从 public/data 加载（同一次会话内缓存，避免重复请求）。 */
export function loadJSON<T>(name: string): Promise<T> {
  const hit = cache.get(name);
  if (hit) return Promise.resolve(hit as T);
  return fetch(`${import.meta.env.BASE_URL}data/${name}`)
    .then((r) => {
      if (!r.ok) throw new Error(`${name} 加载失败：HTTP ${r.status}`);
      return r.json() as Promise<T>;
    })
    .then((v) => {
      cache.set(name, v);
      return v;
    });
}

export function useJSON<T>(name: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    setError(null);
    loadJSON<T>(name)
      .then((v) => alive && setData(v))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [name, n]);
  /** 加载失败后重试（不清缓存：缓存只在成功时写入）。 */
  const reload = () => setN((x) => x + 1);
  return { data, error, loading: !data && !error, reload };
}

export const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);
export const fmt = (n: number) => n.toLocaleString("en-US");
