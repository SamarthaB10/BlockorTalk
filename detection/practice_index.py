"""Import the requested Kaggle data with a repeatable, duplicate-free 80/20 split."""
import hashlib
import json
import os
import re
from pathlib import Path
from zipfile import ZipFile

SOURCE = 'teeconnie/scam-and-non-scam-call-conversation-dataset'
SEED = 'tell-kaggle-80-20-v1'
ROOT = Path(__file__).parents[1]
ARCHIVE = ROOT / 'data/cache/kaggle-scam-calls.zip'


def corpus():
    records = {}
    duplicates = 0
    with ZipFile(ARCHIVE) as archive:
        for filename, label in [('English_NonScam.txt', 0), ('English_Scam.txt', 1)]:
            text = archive.read(filename).decode('utf-8-sig').replace('\r\n', '\n')
            for entry in re.split(r'\n\s*\n', text):
                dialogue = re.sub(r'^\d+\.\s*', '', entry.strip())
                if not dialogue:
                    continue
                digest = hashlib.sha256(' '.join(dialogue.lower().split()).encode()).hexdigest()
                if digest in records:
                    if records[digest][1] != label:
                        raise ValueError('One conversation has conflicting source labels')
                    duplicates += 1
                    continue
                records[digest] = (dialogue, label)
    rows = []
    for label in (0, 1):
        members = sorted((key for key, (_, value) in records.items() if value == label),
                         key=lambda key: hashlib.sha256((SEED + key).encode()).hexdigest())
        if len(members) < 10:
            raise ValueError('Too few conversations for a checked 80/20 split')
        held_out = set(members[:round(len(members) * 0.2)])
        for key in members:
            dialogue, value = records[key]
            rows.append((key, dialogue, value, 'held_out' if key in held_out else 'prompt'))
    pool_id = hashlib.sha256(json.dumps([SOURCE, SEED, sorted((key, label, split)
        for key, _, label, split in rows)]).encode()).hexdigest()
    return pool_id, rows, duplicates


def main():
    import psycopg
    pool_id, rows, duplicates = corpus()
    prompt_count = sum(row[3] == 'prompt' for row in rows)
    held_out_count = len(rows) - prompt_count
    with psycopg.connect(os.environ['DATABASE_URL_DIRECT'], autocommit=True, connect_timeout=10) as conn:
        conn.execute((ROOT / 'migrations/20261108_grounded_practice.sql').read_text())
        conn.execute((ROOT / 'migrations/20261109_kaggle_agent_context.sql').read_text())
        with conn.transaction():
            conn.execute('CREATE TEMP TABLE practice_import (LIKE practice_examples INCLUDING DEFAULTS) ON COMMIT DROP')
            with conn.cursor().copy('COPY practice_import (pool_id,id,dialogue,label,topic,split,source,content_hash) FROM STDIN') as copy:
                for key, dialogue, label, split in rows:
                    copy.write_row((pool_id, key, dialogue, label, None, split, SOURCE, key))
            conn.execute('INSERT INTO practice_examples SELECT * FROM practice_import ON CONFLICT (pool_id,id) DO NOTHING')
            stored = conn.execute('SELECT id,dialogue,label,split FROM practice_examples WHERE pool_id=%s', (pool_id,)).fetchall()
            if set(stored) != set(rows):
                raise ValueError('Stored data differs from the checked Kaggle split')
            conn.execute('''INSERT INTO practice_datasets
                (pool_id,source,embedding_model,prompt_count,held_out_count,retrieval_method)
                VALUES (%s,%s,NULL,%s,%s,'lexical') ON CONFLICT (pool_id) DO NOTHING''',
                (pool_id, SOURCE, prompt_count, held_out_count))
    print(json.dumps({'source': SOURCE, 'pool_id': pool_id, 'prompt': prompt_count,
        'held_out': held_out_count, 'duplicates_removed': duplicates, 'overlap': 0, 'retrieval': 'Postgres full-text'}))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'Practice import failed ({type(error).__name__}); check the archive and database configuration.')
        raise SystemExit(1)
