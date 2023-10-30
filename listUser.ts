import { linear } from './linearAPI';
import { notion } from './notionAPI';

console.log(await linear.users({}));
notion.users.list({}).then((result) => console.log(result.results));
