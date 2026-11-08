"""Binary detection metrics. Scam is the positive class."""

from __future__ import annotations


def confusion_counts(y_true: list[int], y_pred: list[int]) -> tuple[int, int, int, int]:
    if len(y_true) != len(y_pred) or not y_true:
        raise ValueError("predictions and labels must be the same non-empty length")
    tn = fp = fn = tp = 0
    for actual, predicted in zip(y_true, y_pred):
        if actual not in (0, 1) or predicted not in (0, 1):
            raise ValueError(f"labels must be 0 or 1, got {actual} and {predicted}")
        if actual == 0 and predicted == 0:
            tn += 1
        elif actual == 0 and predicted == 1:
            fp += 1
        elif actual == 1 and predicted == 0:
            fn += 1
        else:
            tp += 1
    return tn, fp, fn, tp


def classification_scores(y_true: list[int], y_pred: list[int]) -> dict[str, float | list[list[int]]]:
    tn, fp, fn, tp = confusion_counts(y_true, y_pred)
    total = tn + fp + fn + tp
    accuracy = (tn + tp) / total
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0
    return {
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "confusion_matrix": [[tn, fp], [fn, tp]],
    }


def positive_rate(y_pred: list[int]) -> float:
    if not y_pred:
        raise ValueError("cannot score an empty split")
    if any(label not in (0, 1) for label in y_pred):
        raise ValueError("predictions must be 0 or 1")
    return sum(label == 1 for label in y_pred) / len(y_pred)
