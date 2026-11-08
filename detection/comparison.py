"""Confidence-aware evaluation. Abstentions remain visible and never count as correct."""

from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import statistics
import sys
import time


def score(corpus, detector, workers=1, clock=time.perf_counter):
    def detect(item):
        started = clock()
        result = detector.detect(item.text)
        return {"id": hashlib.sha256(item.text.encode()).hexdigest(), "source": item.source,
                "actual": item.label, "result": result, "seconds": clock() - started}

    groups = {}
    with ThreadPoolExecutor(max_workers=workers) as executor:
        for split, items in corpus.held_out():
            rows = []
            for row in executor.map(detect, items):
                rows.append(row)
                if len(rows) % 50 == 0:
                    print(f"{detector.name}: {split} {len(rows)}/{len(items)}", file=sys.stderr, flush=True)
            groups[split] = rows
    return {"detector": detector.name, "groups": groups}


def format_comparison(corpus, report):
    groups = report["groups"]
    matrix = [[0, 0, 0], [0, 0, 0]]
    for row in groups["synthetic_test"]:
        label = row["result"]["label"]
        column = {"legit": 0, "scam": 1, None: 2}[label]
        matrix[row["actual"]][column] += 1
    tn, fp, ua = matrix[0]
    fn, tp, ub = matrix[1]
    precision = tp / (tp + fp) if tp + fp else 0
    recall = tp / (tp + fn + ub) if tp + fn + ub else 0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0
    total = sum(sum(row) for row in matrix)
    times = [row["seconds"] for rows in groups.values() for row in rows]
    shown_matrix = matrix if ua + ub else [matrix[0][:2], matrix[1][:2]]
    lines = [f"detector: {report['detector']}", f"train: {len(corpus.train)}"]
    lines.extend(f"{split}: {len(rows)}" for split, rows in groups.items())
    lines.extend([
        f"median_detection_seconds: {statistics.median(times):.4f}", "", "Synthetic test",
        f"accuracy: {(tn + tp) / total:.4f}", f"precision: {precision:.4f}",
        f"recall: {recall:.4f}", f"f1: {f1:.4f}", f"confusion_matrix: {shown_matrix}",
    ])
    if ua + ub:
        lines.append("prediction_columns: legit, scam, uncertain (rows: legit, scam)")
    for split, heading, metric in (("real_calls", "Real calls", "detection_rate"),
                                    ("hard_negatives", "Hard negatives", "false_alarm_rate")):
        rows = groups[split]
        rate = sum(row["result"]["label"] == "scam" for row in rows) / len(rows)
        lines.extend(["", heading, f"{metric}: {rate:.4f}", f"n: {len(rows)}"])
    lines.append("")
    for split, rows in groups.items():
        unknown = sum(row["result"]["label"] is None for row in rows)
        lines.append(f"{split}_abstentions: {unknown}/{len(rows)}")
    return "\n".join(lines)


def run(corpus, args, detector_factory, clock):
    # The caller checks the FULL corpus before any limiting. A smoke run cannot
    # accidentally conceal a held-out duplicate outside its selected rows.
    if args.limit:
        from dataclasses import replace
        import random
        selection = {name: random.Random(7).sample(items, min(args.limit, len(items)))
                     for name, items in corpus.held_out()}
        corpus = replace(corpus, **selection)
        print(f"SMOKE RUN: at most {args.limit} items per scoring split; not a full evaluation.")
    if any(not items for _, items in corpus.held_out()):
        raise ValueError("each scoring split must be non-empty")
    reports = []
    with detector_factory(corpus, args.detectors) as detectors:
        for detector in detectors:
            report = score(corpus, detector, args.workers, clock)
            reports.append(report)
            print(format_comparison(corpus, report), flush=True)
    if args.output:
        args.output.write_text(json.dumps({"smoke_limit": args.limit, "reports": reports}, indent=2),
                               encoding="utf-8")
    return 0
