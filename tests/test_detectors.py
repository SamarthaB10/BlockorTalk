import unittest

from detection.baseline import TfidfBaseline
from detection.corpus import load_fixture, LeakageError
from detection.detectors import NemotronDetector
from pathlib import Path
from detection.retrieval import PgvectorPool
import os
import uuid
import contextlib
import io
from detection import evaluate
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from detection.nvidia import NvidiaClient, NvidiaEmbeddings


class FakeLLM:
    def __init__(self, confidence=0.9):
        self.confidence = confidence

    def classify(self, text, examples):
        return {
            "label": "scam", "scam_type": "impersonation", "confidence": self.confidence,
            "red_flags": [{"tactic": "urgency", "text": "right now"}],
        }


class DetectorInterfaceTests(unittest.TestCase):
    def test_uncertain_and_invalid_vendor_answers_never_expose_a_label(self):
        class LLM:
            def __init__(self, payload):
                self.payload = payload

            def classify(self, text, examples):
                return self.payload

        invalid = [None, {},
                   {"label": "scam", "confidence": float("nan"), "red_flags": []},
                   {"label": "scam", "confidence": 1.1, "red_flags": []},
                   {"label": "scam", "confidence": 0.59, "red_flags": []},
                   {"label": "scam", "confidence": 0.9, "red_flags":
                    [{"tactic": "urgency", "text": "fabricated words"}]},
                   {"label": "scam", "confidence": 0.9, "red_flags":
                    [{"tactic": "odd-payment", "text": "right now"}]}]
        for payload in invalid:
            with self.subTest(payload=payload):
                result = NemotronDetector(LLM(payload)).detect("right now")
                self.assertIsNone(result["label"])
                self.assertEqual(result["red_flags"], [])
                self.assertEqual(result["message"],
                                 "Can't tell — verify by calling back on a number you already have")
        self.assertEqual(NemotronDetector(FakeLLM(0.6)).detect("right now")["label"], "scam")

    def test_baseline_abstains_when_it_has_no_evidence(self):
        corpus = load_fixture(Path(__file__).parent / "fixtures/trainable.json")
        result = TfidfBaseline().fit(corpus.train).detect("")
        self.assertIsNone(result["label"])
        self.assertEqual(result["message"],
                         "Can't tell — verify by calling back on a number you already have")

    def test_retrieval_refuses_overlap_before_contacting_database_or_embedding_vendor(self):
        corpus = load_fixture(Path(__file__).parent / "fixtures/trainable.json")
        corpus.synthetic_test.append(corpus.train[0])
        with self.assertRaisesRegex(LeakageError, "the officer demands a wire transfer"):
            PgvectorPool(None, None, corpus)

    def test_embedding_adapter_preserves_order_on_single_input_endpoint(self):
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def do_POST(self):
                body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                if len(body["input"]) != 1:
                    self.send_response(500)
                    self.end_headers()
                    return
                data = {"data": [{"index": 0, "embedding":
                                  [float(body["input"][0]), *([0.0] * 1023)]}]}
                self.send_response(200)
                self.end_headers()
                self.wfile.write(json.dumps(data).encode())

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            client = NvidiaClient({"NVIDIA_API_KEY": "fake", "NVIDIA_BASE_URL":
                                   f"http://127.0.0.1:{server.server_port}"})
            vectors = NvidiaEmbeddings(client).embed(["1", "2"], "passage")
            self.assertEqual([v[0] for v in vectors], [1.0, 2.0])
            self.assertEqual([len(v) for v in vectors], [1024, 1024])
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    def test_baseline_and_zero_shot_return_the_shared_shape(self):
        corpus = load_fixture(Path(__file__).parent / "fixtures/trainable.json")
        detectors = [TfidfBaseline().fit(corpus.train), NemotronDetector(FakeLLM())]
        text = "the officer demands a wire transfer right now"
        for detector in detectors:
            with self.subTest(detector=detector.name):
                result = detector.detect(text)
                self.assertEqual(set(result), {"label", "scam_type", "red_flags", "confidence", "message"})
                self.assertEqual(result["label"], "scam")
                self.assertGreaterEqual(result["confidence"], 0.6)
                self.assertIsNone(result["message"])
                self.assertTrue(result["red_flags"])
                flag = next(f for f in result["red_flags"] if f["tactic"] == "urgency")
                self.assertEqual(flag["span"], {"start": 36, "end": 45, "text": "right now"})

    def test_evaluation_entrypoint_prints_three_reports_with_metrics_and_median_time(self):
        class LLM:
            def classify(self, text, examples):
                return {"label": "scam" if "officer" in text else "legit",
                        "scam_type": None, "confidence": 0.9, "red_flags": []}

        class Pool:
            def nearest(self, text):
                return load_fixture(Path(__file__).parent / "fixtures/trainable.json").train[:5]

        def factory(corpus, mode):
            return contextlib.nullcontext([
                TfidfBaseline().fit(corpus.train), NemotronDetector(LLM()), NemotronDetector(LLM(), Pool()),
            ])

        output = io.StringIO()
        ticks = iter(range(100))
        with contextlib.redirect_stdout(output):
            status = evaluate.main(["--fixture", str(Path(__file__).parent / "fixtures/trainable.json"),
                                    "--detectors", "all", "--workers", "1"],
                                   detector_factory=factory, clock=lambda: next(ticks))
        self.assertEqual(status, 0)
        report = output.getvalue()
        self.assertEqual(report.count("detector:"), 3)
        for name in ("tfidf-logistic-regression", "nemotron-zero-shot", "nemotron-retrieval"):
            self.assertIn(f"detector: {name}", report)
        self.assertEqual(report.count("median_detection_seconds: 1.0000"), 3)
        self.assertEqual(report.count("confusion_matrix: [[1, 0], [0, 1]]"), 3)
        self.assertEqual(report.count("detection_rate: 1.0000"), 3)
        self.assertEqual(report.count("false_alarm_rate: 0.0000"), 3)

    def test_evaluation_counts_abstentions_in_denominators_and_reports_them(self):
        def factory(corpus, mode):
            return contextlib.nullcontext([NemotronDetector(FakeLLM(0.59))])

        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            status = evaluate.main(["--fixture", str(Path(__file__).parent / "fixtures/trainable.json"),
                                    "--detectors", "all"], detector_factory=factory)
        self.assertEqual(status, 0)
        report = output.getvalue()
        self.assertIn("accuracy: 0.0000", report)
        self.assertIn("confusion_matrix: [[0, 0, 1], [0, 0, 1]]", report)
        self.assertIn("detection_rate: 0.0000", report)
        self.assertIn("hard_negatives_abstentions: 2/2", report)


@unittest.skipUnless(os.environ.get("TEST_DATABASE_URL"), "TEST_DATABASE_URL required (pgvector)")
class RetrievalTests(unittest.TestCase):
    def test_five_nearest_are_train_only_and_retrieval_uses_shared_contract(self):
        import psycopg
        from psycopg import sql
        from detection.corpus import Corpus, Item

        class Embeddings:
            model = "fixture-1024"

            def embed(self, texts, input_type):
                return [[1.0, float(text.split(":")[0]), *([0.0] * 1022)] for text in texts]

        train = [Item(f"{i}: train dialogue", i % 2, "train", "fixture") for i in range(8)]
        corpus = Corpus(train, [Item("0.001: held out", 1, "synthetic_test", "fixture")], [], [])
        schema = "detector_test_" + uuid.uuid4().hex
        with psycopg.connect(os.environ["TEST_DATABASE_URL"], autocommit=True) as connection:
            connection.execute("CREATE EXTENSION IF NOT EXISTS vector")
            connection.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema)))
            try:
                connection.execute(sql.SQL("SET search_path TO {}, public").format(sql.Identifier(schema)))
                connection.execute((Path(__file__).parents[1] / "migrations/007_detection_examples.sql").read_text())
                pool = PgvectorPool(connection, Embeddings(), corpus)
                pool.index()
                self.assertEqual([i.text for i in pool.nearest("0: query")],
                                 ["0: train dialogue", "1: train dialogue", "2: train dialogue",
                                  "3: train dialogue", "4: train dialogue"])
                self.assertTrue(all(i.split == "train" for i in pool.nearest("0: query")))
                result = NemotronDetector(FakeLLM(0.59), pool).detect("0: right now")
                self.assertEqual(result, {"label": None, "scam_type": None, "red_flags": [],
                                         "confidence": 0.59,
                                         "message": "Can't tell — verify by calling back on a number you already have"})
            finally:
                connection.execute("SET search_path TO public")
                connection.execute(sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(schema)))


if __name__ == "__main__":
    unittest.main()
