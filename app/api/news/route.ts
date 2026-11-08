import { createNewsService } from '../../../lib/news/service';
import { createNewsHandlers } from '../../../lib/news/routes';

export const dynamic = 'force-dynamic';

/** Official alerts plus wider reporting when the server's NewsAPI key is set. */
export const { GET } = createNewsHandlers({
  load: createNewsService({ apiKey: () => process.env.NEWS_API_KEY }),
});
