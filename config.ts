export const config = {
  notion: {
    api_key: process.env.NOTION_API_KEY,
    database_id: process.env.NOTION_DATABASE_ID,
  },
  linear: {
    api_key: process.env.LINEAR_API_KEY,
    project_id: process.env.LINEAR_PROJECT_ID,
  },
  poll_interval: process.env.POLL_INTERVAL,
};

console.log('CONFIG', config);

export default config;
