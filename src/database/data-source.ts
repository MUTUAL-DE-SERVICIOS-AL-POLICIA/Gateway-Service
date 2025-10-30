import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import { SeederOptions } from 'typeorm-extension';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { DbEnvs } from 'src/config';

config();

export const options: DataSourceOptions & SeederOptions = {
  type: 'postgres' as const,
  host: process.env.DB_HOST,
  port: +DbEnvs.dbPort,
  database: DbEnvs.dbDatabase,
  username: DbEnvs.dbUsername,
  password: DbEnvs.dbPassword,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: true,
  namingStrategy: new SnakeNamingStrategy(),

  seeds: ['src/database/seeds/**/*{.ts,.js}'],
  seedTracking: true,

  schema: 'public',
  migrations: ['dist/database/migrations/**/*{.ts,.js}'],
};

export default new DataSource(options);
