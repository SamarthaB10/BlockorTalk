"""TF-IDF plus logistic regression. It exists so later detectors have something to beat."""

from __future__ import annotations

from detection.corpus import Item
from detection.result import result_from_quotes
import re


# The binary corpus has no tactic/type annotations. These are transparent keyword
# explanations, not learned tactic predictions; the baseline cannot infer scam type.
PATTERNS = {
    "authority": r"\b(officer|fraud department|security team|official)\b",
    "urgency": r"\b(right now|immediately|urgent|expires|deadline)\b",
    "details-as-proof": r"\b(our records|on file|already know your)\b",
    "reward": r"\b(prize|reward|bonus|free)\b",
    "fear": r"\b(arrest|suspended|frozen|locked|compromised)\b",
}


class TfidfBaseline:
    name = "tfidf-logistic-regression"

    def __init__(self) -> None:
        self.vectorizer = None
        self.model = None

    def fit(self, items: list[Item]) -> "TfidfBaseline":
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.linear_model import LogisticRegression

        if not items:
            raise ValueError("cannot train on an empty example pool")
        labels = [item.label for item in items]
        if set(labels) != {0, 1}:
            raise ValueError("the example pool needs both scam and legitimate dialogues")
        self.vectorizer = TfidfVectorizer(
            lowercase=True,
            ngram_range=(1, 2),
            min_df=1,
            max_features=40000,
        )
        self.model = LogisticRegression(max_iter=500, solver="liblinear", random_state=0)
        self.model.fit(self.vectorizer.fit_transform([item.text for item in items]), labels)
        return self

    def predict(self, items: list[Item]) -> list[int]:
        if self.model is None or self.vectorizer is None:
            raise ValueError("train the baseline before predicting")
        if not items:
            return []
        features = self.vectorizer.transform([item.text for item in items])
        return [int(label) for label in self.model.predict(features)]

    def detect(self, text: str) -> dict:
        if self.model is None or self.vectorizer is None:
            raise ValueError("train the baseline before detecting")
        probabilities = self.model.predict_proba(self.vectorizer.transform([text]))[0]
        index = int(probabilities.argmax())
        label = int(self.model.classes_[index])
        flags = [{"tactic": tactic, "text": match.group()}
                 for tactic, pattern in PATTERNS.items()
                 for match in re.finditer(pattern, text, re.IGNORECASE)] if label else []
        return result_from_quotes(text, {
            "label": "scam" if label else "legit", "scam_type": None,
            "confidence": float(probabilities[index]), "red_flags": flags,
        })
