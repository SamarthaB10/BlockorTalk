import pg from 'pg';
import { KAGGLE_SOURCE } from '../../practice/sources';
import type { Version } from './types';

const keywords: Record<string, string> = {
  'Bank fraud alert': 'bank fraud account transaction security code',
  'Delivery or customs fee': 'delivery parcel customs shipping fee',
  'Holiday gift card or travel deal': 'holiday gift card travel deal vacation',
  'Business invoice or CEO wire': 'business invoice executive wire payment',
  'Phishing link texted mid-call': 'link text message verify account',
  'Tech support': 'technical support computer virus device',
  'Government (IRS or SSN)': 'government tax social security notice',
  'Prize or sweepstakes': 'prize sweepstakes lottery winner reward',
  'Crypto or investment': 'crypto investment trading profit',
  'Phone carrier port-out': 'phone mobile carrier transfer port account',
};
export type ScenarioExample = { id: string; dialogue: string; label: 0 | 1; source: string };

export function createScenarioCorpus(connectionString: string) {
  return {
    async examples(category: string, version: Version): Promise<ScenarioExample[]> {
      if (!keywords[category] || !['real', 'scam'].includes(version)) throw new Error('Unknown scenario Category or Version.');
      if (!connectionString) throw new Error('The example database is not configured.');
      const client = new pg.Client({ connectionString, connectionTimeoutMillis: 5000 });
      await client.connect();
      try {
        // Rank all eligible rows: matches lead and zero-rank same-label rows fill thin Categories.
        // Only the latest pool for each supported source participates.
        const result = await client.query(`WITH pools AS (
          SELECT DISTINCT ON (source) pool_id,source FROM practice_datasets
          WHERE source=ANY($1::text[])
          ORDER BY source,created_at DESC,pool_id
        ) SELECT e.id,e.dialogue,e.label,e.source FROM practice_examples e
          JOIN pools p ON p.pool_id=e.pool_id AND p.source=e.source
          WHERE e.split='prompt' AND e.label=$2
          ORDER BY ts_rank_cd(to_tsvector('english',e.dialogue),to_tsquery('english',$3)) DESC,e.source,e.id
          LIMIT 5`, [[KAGGLE_SOURCE, 'BothBosu/scam-dialogue'], version === 'real' ? 0 : 1, keywords[category]!.split(' ').join(' | ')]);
        if (result.rows.length !== 5) throw new Error('The supported prompt pools need at least five examples for this Version.');
        return result.rows as ScenarioExample[];
      } finally { await client.end(); }
    },
  };
}
