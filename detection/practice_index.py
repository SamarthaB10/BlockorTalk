"""Import the published 80/20 split for practice, without moving any evaluation item."""
import hashlib
import json
import os
from pathlib import Path

from detection.corpus import load_real_corpus, assert_no_leakage, normalize
from detection.nvidia import NvidiaClient, NvidiaEmbeddings
from detection.retrieval import PgvectorPool, item_id


def main():
    import psycopg
    corpus = load_real_corpus()
    assert_no_leakage(corpus)
    prompt = corpus.train
    held_out = corpus.synthetic_test
    # Preserve the publisher's test set. Two known duplicate training rows were removed.
    if abs(len(held_out) / (len(prompt) + len(held_out)) - 0.2) > 0.005:
        raise ValueError('The published split is not approximately 80/20; inspect the source before importing')
    root = Path(__file__).parents[1]
    with psycopg.connect(os.environ['DATABASE_URL_DIRECT'], autocommit=True, connect_timeout=10) as conn:
        conn.execute((root / 'migrations/007_detection_examples.sql').read_text())
        conn.execute((root / 'migrations/20261108_grounded_practice.sql').read_text())
        pool = PgvectorPool(conn, NvidiaEmbeddings(NvidiaClient()), corpus)
        pool.index()  # Reuse existing vectors; request only missing embeddings.
        with conn.transaction():
            conn.execute('CREATE TEMP TABLE practice_import (LIKE practice_examples INCLUDING DEFAULTS) ON COMMIT DROP')
            with conn.cursor().copy('COPY practice_import (pool_id,id,dialogue,label,topic,split,source,content_hash) FROM STDIN') as copy:
                for split, items in [('prompt', prompt), ('held_out', held_out)]:
                    for item in items:
                        copy.write_row((pool.pool_id, item_id(item), item.text, item.label, item.scam_type,
                                        split, item.source, hashlib.sha256(normalize(item.text).encode()).hexdigest()))
            conn.execute('INSERT INTO practice_examples SELECT * FROM practice_import ON CONFLICT (pool_id,id) DO NOTHING')
            rows = conn.execute('SELECT id,dialogue,label,topic,split,source FROM practice_examples WHERE pool_id=%s', (pool.pool_id,)).fetchall()
            expected = {(item_id(i), i.text, i.label, i.scam_type, split, i.source)
                        for split, items in [('prompt', prompt), ('held_out', held_out)] for i in items}
            if set(rows) != expected:
                raise ValueError('Stored practice dataset differs from the checked split')
            conn.execute('''INSERT INTO practice_datasets (pool_id,source,embedding_model,prompt_count,held_out_count)
                VALUES (%s,%s,%s,%s,%s) ON CONFLICT (pool_id) DO UPDATE
                SET prompt_count=EXCLUDED.prompt_count,held_out_count=EXCLUDED.held_out_count''',
                (pool.pool_id, 'BothBosu/scam-dialogue', pool.embeddings.model, len(prompt), len(held_out)))
        print(json.dumps({'pool_id': pool.pool_id, 'prompt': len(prompt), 'held_out': len(held_out),
                          'overlap': 0, 'embedding_model': pool.embeddings.model}))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'Practice import failed ({type(error).__name__}); inspect the source split, database and endpoint configuration.')
        raise SystemExit(1)
