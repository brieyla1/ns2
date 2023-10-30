import { linear } from './linearAPI';

console.log(
  (await linear.teams({})).nodes.map((el) => ({
    id: el.id,
    name: el.name,
  }))
);
