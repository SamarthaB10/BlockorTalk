"""TF-IDF plus logistic regression. It exists so later detectors have something to beat."""

from __future__ import annotations

from detection.corpus import Item


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
