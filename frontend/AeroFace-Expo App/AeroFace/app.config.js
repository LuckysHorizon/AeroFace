const path = require('path');
const dotenv = require('dotenv');

const rootEnvPath = path.resolve(__dirname, '../../../.env');

dotenv.config({ path: rootEnvPath });
dotenv.config();

module.exports = ({ config }) => ({
  ...config,
  extra: {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_KEY,
  },
});
