import 'dotenv/config';
import { DataSource } from 'typeorm';
import { loadRuntimeDatabaseOptions } from './database.config';

const dataSource = loadRuntimeDatabaseOptions().then(
  (options) => new DataSource(options),
);

export default dataSource;
