import knex from 'knex';
import { config } from '../config/env.js';

const db = knex({
  client: 'pg',
  connection: {
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: config.database.database,
  },
  pool: {
    min: 2,
    max: config.database.poolLimit,
  },
});

export default db;
