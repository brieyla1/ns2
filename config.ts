export const config = {
  notion: {
    api_key: process.env.NOTION_API_KEY,
    database_id: process.env.NOTION_DATABASE_ID,
  },
  linear: {
    api_key: process.env.LINEAR_API_KEY,
    team_id: process.env.LINEAR_TEAM_ID,
  },
  poll_interval: process.env.POLL_INTERVAL,
};

export default config;
