"""把 SQLite 导出为静态站用的 JSON（只读 · 幂等 · 打印体积）。

用法：
  python web\\scripts\\export_data.py

输出：web/public/data/*.json
  meta.json      版本 / 库 sha16 / 生成时间 / 全局统计
  biodist.json   3,917 行核心字段（不含 raw_text）
  raw.json       id -> raw_text（按需加载）
  drugs.json     5,159 个核药
  tables.json    947 张分布表
  refs.json      被引文献（去重 PMID）
  stats.json     各维度聚合

红线：只读（mode=ro + PRAGMA query_only=1）；不做任何口径美化。
"""
import csv
import hashlib
import json
import sqlite3
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(r"D:\nucmed")
DB = ROOT / "db" / "nucmed.db"
OUT = ROOT / "web" / "public" / "data"

POINT_COLS = [
    "id", "drug_id", "organ_norm", "is_tumor", "isotope", "time_h",
    "value_num", "value_sd", "value_unit", "evidence_grade", "doc_pmid",
    "source_kind", "subject_key", "species",
]


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def dump(name: str, obj) -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / name
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    return path.stat().st_size


def rows_to_dicts(con, sql: str, cols: list) -> list:
    cur = con.execute(sql)
    return [dict(zip(cols, r)) for r in cur.fetchall()]


def main() -> int:
    if not DB.exists():
        print(f"FAIL 库不存在：{DB}")
        return 2
    sha = sha256_of(DB)
    con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    con.execute("PRAGMA query_only=1")
    try:
        sizes = {}

        pts = rows_to_dicts(
            con,
            "SELECT "
            + ",".join("p." + c for c in POINT_COLS)
            + ",d.name_en FROM biodist_point p LEFT JOIN drug d ON d.id = p.drug_id ORDER BY p.id",
            POINT_COLS + ["drug_en"],
        )
        sizes["biodist.json"] = dump("biodist.json", pts)

        raw = {}
        for pid, txt in con.execute(
            "SELECT id, raw_text FROM biodist_point "
            "WHERE raw_text IS NOT NULL AND TRIM(raw_text) <> '' ORDER BY id"
        ):
            raw[str(pid)] = txt
        sizes["raw.json"] = dump("raw.json", raw)

        # 药物列表取自 v_drug_overview（原 app.py 总览页用的就是这个视图）
        struct_dir = ROOT / "docs" / "assets" / "structures"

        def has_struct(drug_id: int) -> int:
            webp = ROOT / "web" / "public" / "struct" / f"{drug_id}.webp"
            if webp.exists():
                return 1
            for sub in ("ligand", "peptide2d", "schematic"):
                d = struct_dir / sub
                if (d / f"{drug_id}.png").exists() or (d / f"drug_{drug_id}.png").exists():
                    return 1
            return 0

        drug_cols = [
            "drug_id", "name_en", "name_zh", "drug_type", "status",
            "radionuclides_zh", "targets_zh", "diseases_zh",
            "chelators_zh", "linkers_zh", "vectors_zh",
        ]
        drugs = rows_to_dicts(
            con,
            "SELECT " + ",".join(drug_cols) + " FROM v_drug_overview ORDER BY drug_id",
            drug_cols,
        )
        pt_count = dict(
            con.execute("SELECT drug_id, COUNT(*) FROM biodist_point GROUP BY drug_id").fetchall()
        )
        # ★ 2026-10-28 pk261：单药画像要按 tab 显示「有无数据」⇒ 需要各层条数
        dos_count = dict(
            con.execute("SELECT drug_id, COUNT(*) FROM dosimetry GROUP BY drug_id").fetchall()
        )
        # ★ property_evidence 无法按药统计：其 subject_key 是「核素|药名片段」(如 `I-131|monoclonal`)，
        #   不是 drug.id ⇒ 按药计数做不出来（2026-10-28 实测，不要去硬凑名称匹配）。
        #   前端「性质与证据」tab 改为**全库聚合视角**（用 props_agg.json），不按药过滤。
        ref_count = {}
        for did, n in con.execute(
            "SELECT drug_id, COUNT(DISTINCT doc_pmid) FROM biodist_point "
            "WHERE doc_pmid IS NOT NULL AND TRIM(doc_pmid) <> '' GROUP BY drug_id"
        ):
            ref_count[did] = n
        # 靶本比：同药同时间点同时有 tumor 与 blood ⇒ 可算
        tbr_drugs = {
            r[0] for r in con.execute(
                "SELECT drug_id FROM biodist_point WHERE organ_norm='tumor' "
                "INTERSECT SELECT drug_id FROM biodist_point WHERE organ_norm='blood'"
            )
        }

        def name_level(name: str) -> str:
            """药名质量判定（只标「明确是检查流程 / 句子」的，宁漏不误）。"""
            n = name or ""
            low = n.lower()
            bad = (
                "pet/ct", "pet-ct", "pet ct", " scan", "scan ", "imaging",
                "injection of", "administration", "procedure",
                "protocol", " before ", " after ", "use of", "execution of",
            )
            if any(b in low for b in bad):
                return "bad"
            return "ok"

        suspect = []
        for d in drugs:
            d["has_struct"] = has_struct(d["drug_id"])
            d["n_points"] = pt_count.get(d["drug_id"], 0)
            d["n_dosim"] = dos_count.get(d["drug_id"], 0)
            d["n_refs"] = ref_count.get(d["drug_id"], 0)
            d["has_tbr"] = 1 if d["drug_id"] in tbr_drugs else 0
            lv = name_level(d["name_en"])
            d["name_ok"] = 0 if lv == "bad" else 1
            if lv != "ok":
                suspect.append([d["drug_id"], d["name_en"], lv])

        csv_path = ROOT / "logs" / "pk254_scratch" / "drugname_suspect.csv"
        csv_path.parent.mkdir(parents=True, exist_ok=True)
        with open(csv_path, "w", encoding="utf-8-sig", newline="") as fh:
            w = csv.writer(fh)
            w.writerow(["drug_id", "name_en", "level"])
            w.writerows(suspect)
        n_bad = sum(1 for s in suspect if s[2] == "bad")
        print(f"  name check: bad={n_bad} suspect={len(suspect) - n_bad} -> {csv_path.name}")
        sizes["drugs.json"] = dump("drugs.json", drugs)

        tabs = rows_to_dicts(
            con,
            "SELECT id, drug_id, doc_pmid FROM biodist_table ORDER BY id",
            ["id", "drug_id", "doc_pmid"],
        )
        sizes["tables.json"] = dump("tables.json", tabs)

        # 剂量学（2026-10-28 pk258 补 FDA label 后 37 → 403 行）
        # ★ 前端此前完全没有出口 ⇒ 补 403 行在界面上一条都看不到
        dos_cols = [
            "drug_id", "organ_norm", "organ_raw", "species", "isotope",
            "value_num", "value_unit", "model", "evidence_grade",
            "source_field", "raw_text",
        ]
        dos = rows_to_dicts(
            con,
            "SELECT " + ",".join("s." + c for c in dos_cols) + ",d.name_en "
            "FROM dosimetry s LEFT JOIN drug d ON d.id = s.drug_id ORDER BY s.id",
            dos_cols + ["drug_en"],
        )
        # 压缩字段名（403 行 × 12 字段，体积可控，但仍按前端习惯用短键）
        dos_out = []
        for r in dos:
            dos_out.append({
                "did": r["drug_id"],
                "drug": r["drug_en"],
                "organ": r["organ_norm"],
                "organ_raw": r["organ_raw"],
                "species": r["species"],
                "iso": r["isotope"],
                "v": r["value_num"],
                "u": r["value_unit"],
                "model": r["model"],
                "grade": r["evidence_grade"],
                "src": r["source_field"],
                "raw": (r["raw_text"] or "")[:600],
            })
        sizes["dosimetry.json"] = dump("dosimetry.json", dos_out)

        refs = rows_to_dicts(
            con,
            "SELECT pmid, title, journal, year, doi FROM lit_doc "
            "WHERE pmid IS NOT NULL AND pmid IN "
            "(SELECT doc_pmid FROM biodist_point WHERE doc_pmid IS NOT NULL) "
            "GROUP BY pmid ORDER BY pmid",
            ["pmid", "title", "journal", "year", "doi"],
        )
        sizes["refs.json"] = dump("refs.json", refs)

        # 文献性质（原「📑 文献性质 v0.2」页）—— 不含 raw_text 以控体积
        prop_cols = [
            "drug_id", "prop_code", "value_num", "unit", "organ",
            "timepoint_h", "isotope", "method", "confidence", "evidence_grade",
        ]
        props = rows_to_dicts(
            con,
            "SELECT " + ",".join(prop_cols) + " FROM drug_property ORDER BY id",
            prop_cols,
        )
        sizes["props.json"] = dump("props.json", props)

        # ★ 文献性质的**聚合出口**（2026-10-28 pk261）
        # 为什么：props.json 45,341 行 = 前端分页 30 行/页 ⇒ **1,512 页**，
        #   这张表对读者没有意义（没人翻 1,512 页），且整包 8.26 MB 占总量 63%。
        #   真实问题是「这份证据体系长什么样」⇒ 需要的是分布，不是明细。
        #   明细仍保留 props.json（按需加载），本文件供总览/图表使用。
        from collections import defaultdict

        agg = {
            "total": len(props),
            "by_prop": {},
            "by_method": defaultdict(int),
            "by_grade": defaultdict(int),
            "by_isotope": defaultdict(int),
            "by_organ": defaultdict(int),
        }
        for r in props:
            code = r["prop_code"] or "(空)"
            e = agg["by_prop"].setdefault(code, {
                "n": 0, "n_val": 0, "grade": defaultdict(int),
                "unit": defaultdict(int), "method": defaultdict(int),
            })
            e["n"] += 1
            if r["value_num"] is not None:
                e["n_val"] += 1
            e["grade"][r["evidence_grade"] or "(空)"] += 1
            if r["unit"]:
                e["unit"][r["unit"]] += 1
            if r["method"]:
                e["method"][r["method"]] += 1
                agg["by_method"][r["method"]] += 1
            if r["evidence_grade"]:
                agg["by_grade"][r["evidence_grade"]] += 1
            if r["isotope"]:
                agg["by_isotope"][r["isotope"]] += 1
            if r["organ"]:
                agg["by_organ"][r["organ"]] += 1

        for v in agg["by_prop"].values():
            for k in ("grade", "unit", "method"):
                v[k] = dict(v[k])
        for k in ("by_method", "by_grade", "by_isotope", "by_organ"):
            agg[k] = dict(sorted(agg[k].items(), key=lambda kv: -kv[1]))
        # by_prop 按条数降序
        agg["by_prop"] = dict(sorted(
            agg["by_prop"].items(), key=lambda kv: -kv[1]["n"]))
        sizes["props_agg.json"] = dump("props_agg.json", agg)

        # ★ 2026-10-28：库外候选**不再导出**（原「🗂 库外候选」页已下线）
        #   理由：① 三页架构里前端不加载它；② 它是内部待办清单（3,779 个未入库候选 +
        #   tier 分级 + namedness），性质与「已完成的事实数据」不同，不适合随网站公开。
        #   将来若要展示覆盖边界，在本地临时导出，不要默认写进 public/data。
        # cand_cols = [
        #     "canon_key", "name", "nuclide", "tier", "target_zh",
        #     "n_pmids", "n_trials", "namedness", "top_journal",
        # ]
        # cands = rows_to_dicts(
        #     con,
        #     "SELECT " + ",".join(cand_cols) + " FROM ext_candidate ORDER BY canon_key",
        #     cand_cols,
        # )
        # sizes["candidates.json"] = dump("candidates.json", cands)

        def dist(sql: str) -> list:
            return [{"k": r[0], "n": r[1]} for r in con.execute(sql).fetchall()]

        total = con.execute("SELECT COUNT(*) FROM biodist_point").fetchone()[0]
        l1 = con.execute(
            "SELECT COUNT(*) FROM biodist_point WHERE doc_pmid IS NOT NULL AND TRIM(doc_pmid)<>''"
        ).fetchone()[0]
        l2 = con.execute(
            "SELECT COUNT(*) FROM biodist_point WHERE doc_pmid IN "
            "(SELECT pmid FROM lit_doc WHERE pmid IS NOT NULL)"
        ).fetchone()[0]
        l3 = con.execute(
            "SELECT COUNT(*) FROM biodist_point WHERE doc_pmid IN "
            "(SELECT pmid FROM lit_doc WHERE pmid IS NOT NULL AND oa_status='open')"
        ).fetchone()[0]

        stats = {
            "total": total,            "drugs": con.execute("SELECT COUNT(*) FROM drug").fetchone()[0],
            "organs": con.execute("SELECT COUNT(DISTINCT organ_norm) FROM biodist_point").fetchone()[0],
            "tables": con.execute("SELECT COUNT(*) FROM biodist_table").fetchone()[0],
            "tiers": {"l1_has_pmid": l1, "l2_in_lit": l2, "l3_oa": l3},
            "by_grade": dist("SELECT COALESCE(evidence_grade,'(null)'),COUNT(*) FROM biodist_point GROUP BY 1 ORDER BY 2 DESC"),
            "by_source": dist("SELECT source_kind,COUNT(*) FROM biodist_point GROUP BY 1 ORDER BY 2 DESC"),
            "by_organ": dist("SELECT organ_norm,COUNT(*) FROM biodist_point GROUP BY 1 ORDER BY 2 DESC"),
            "by_isotope": dist("SELECT COALESCE(isotope,'(null)'),COUNT(*) FROM biodist_point GROUP BY 1 ORDER BY 2 DESC"),
            "by_species": dist("SELECT COALESCE(species,'(null)'),COUNT(*) FROM biodist_point GROUP BY 1 ORDER BY 2 DESC"),
            "by_status": dist("SELECT COALESCE(status,'(未标注)'),COUNT(*) FROM v_drug_overview GROUP BY 1 ORDER BY 2 DESC"),
            "by_drug_type": dist("SELECT COALESCE(drug_type,'(未分类)'),COUNT(*) FROM v_drug_overview GROUP BY 1 ORDER BY 2 DESC"),
        }
        # ★ 2026-10-28 pk261：首页 KPI 必须用「有数据的药」，不能用 drug 表全量
        #   （drug 表 5,159 行，但只有 861 个药有分布、35 个有剂量学；
        #    直接显示 5,159 会让人以为五千个药都有数据 —— 审稿人一眼就会问）
        stats["dosimetry"] = {
            "total": con.execute("SELECT COUNT(*) FROM dosimetry").fetchone()[0],
            "drugs": con.execute("SELECT COUNT(DISTINCT drug_id) FROM dosimetry").fetchone()[0],
            "organs": con.execute("SELECT COUNT(DISTINCT organ_norm) FROM dosimetry").fetchone()[0],
        }
        stats["coverage"] = {
            "drugs_total": con.execute("SELECT COUNT(*) FROM drug").fetchone()[0],
            "drugs_with_biodist": con.execute(
                "SELECT COUNT(DISTINCT drug_id) FROM biodist_point"
            ).fetchone()[0],
            "drugs_with_dosim": con.execute(
                "SELECT COUNT(DISTINCT drug_id) FROM dosimetry"
            ).fetchone()[0],
            "drugs_with_struct": sum(1 for d in drugs if d["has_struct"]),
        }
        # 数据质量块（前端「数据质量」页用 · 全部现算）
        parts_dir = ROOT / "web" / "public" / "parts"
        stats["quality"] = {
            "drugs_with_points": con.execute(
                "SELECT COUNT(DISTINCT drug_id) FROM biodist_point"
            ).fetchone()[0],
            "drugs_total": con.execute("SELECT COUNT(*) FROM drug").fetchone()[0],
            "doc_pmid_null": con.execute(
                "SELECT COUNT(*) FROM biodist_point WHERE doc_pmid IS NULL OR TRIM(doc_pmid)=''"
            ).fetchone()[0],
            "table_id_null": con.execute(
                "SELECT COUNT(*) FROM biodist_point WHERE table_id IS NULL"
            ).fetchone()[0],
            "value_gt_100": con.execute(
                "SELECT COUNT(*) FROM biodist_point WHERE value_num > 100"
            ).fetchone()[0],
            "value_gt_100_a": con.execute(
                "SELECT COUNT(*) FROM biodist_point WHERE value_num > 100 AND evidence_grade='A'"
            ).fetchone()[0],
            "a_no_rawtext": con.execute(
                "SELECT COUNT(*) FROM biodist_point WHERE evidence_grade='A' "
                "AND (raw_text IS NULL OR TRIM(raw_text)='')"
            ).fetchone()[0],
            "dup_same_groups": con.execute(
                "SELECT COUNT(*) FROM (SELECT drug_id,organ_norm,isotope,time_h,value_unit,subject_key,"
                "COUNT(*) n,COUNT(DISTINCT value_num) dv FROM biodist_point "
                "GROUP BY 1,2,3,4,5,6 HAVING n>1 AND dv=1)"
            ).fetchone()[0],
            "dup_diff_groups": con.execute(
                "SELECT COUNT(*) FROM (SELECT drug_id,organ_norm,isotope,time_h,value_unit,subject_key,"
                "COUNT(*) n,COUNT(DISTINCT value_num) dv FROM biodist_point "
                "GROUP BY 1,2,3,4,5,6 HAVING n>1 AND dv>1)"
            ).fetchone()[0],
            "parts": {
                k: len(list(parts_dir.glob(f"*_{k}.png"))) if parts_dir.exists() else 0
                for k in ("chelator", "linker", "vector")
            },
            "struct_webp": len(list((ROOT / "web" / "public" / "struct").glob("*.webp")))
            if (ROOT / "web" / "public" / "struct").exists()
            else 0,
        }
        sizes["stats.json"] = dump("stats.json", stats)

        meta = {
            "version": "data-v" + datetime.now(tz=UTC).astimezone().strftime("%Y-%m-%d"),
            "db_sha16": sha[:16],
            "db_bytes": DB.stat().st_size,
            "generated_at": datetime.now(tz=UTC).astimezone().isoformat(timespec="seconds"),
            "counts": {"biodist": total, "drugs": stats["drugs"], "tables": stats["tables"], "refs": len(refs)},
            "files": {k: v for k, v in sorted(sizes.items())},
        }
        dump("meta.json", meta)
    finally:
        con.close()

    print("== 导出完成 ==")
    total_bytes = 0
    for name, size in sorted(sizes.items()):
        total_bytes += size
        print(f"  {name:<15} {size:>10,} B  ({size / 1024:.0f} KB)")
    print(f"  {'合计':<14} {total_bytes:>10,} B  ({total_bytes / 1024 / 1024:.2f} MB)")
    print(f"  库 sha16 = {sha[:16]}  ·  输出目录 {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
