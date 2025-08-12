import 'dotenv/config';
import * as joi from 'joi';

interface EnvVars {
  PORT: number;

  NATS_SERVERS: string[];

  FRONTENDS_SERVERS: string[];

  PVT_BE_API_SERVER: string;
  PVT_BACKEND_API_SERVER: string;
  PVT_HASH_SECRET: string;

  DB_PASSWORD: string;
  DB_DATABASE: string;
  DB_HOST: string;
  DB_PORT: number;
  DB_USERNAME: string;

  FTP_HOST: string;
  FTP_USERNAME: string;
  FTP_PASSWORD: string;
  FTP_ROOT: string;
  FTP_SSL: boolean;

}

const envsSchema = joi
  .object({
    PORT: joi.number().required(),

    NATS_SERVERS: joi.array().items(joi.string()).required(),
    FRONTENDS_SERVERS: joi.array().items(joi.string()).required(),

    FTP_HOST: joi.string(),
    FTP_USERNAME: joi.string(),
    FTP_PASSWORD: joi.string(),
    FTP_ROOT: joi.string(),
    FTP_SSL: joi.boolean(),

    PVT_API_SERVER: joi.string(),
    PVT_HASH_SECRET: joi.string(),

    DB_PASSWORD: joi.string().required(),
    DB_DATABASE: joi.string().required(),
    DB_HOST: joi.string().required(),
    DB_PORT: joi.number().required(),
    DB_USERNAME: joi.string().required(),
  })
  .unknown(true);

const { error, value } = envsSchema.validate({
  ...process.env,
  NATS_SERVERS: process.env.NATS_SERVERS?.split(','),
  FRONTENDS_SERVERS: process.env.FRONTENDS_SERVERS?.split(','),
});

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const envVars: EnvVars = value;

export const PortEnvs = {
  port: envVars.PORT,
};

export const NastEnvs = {
  natsServers: envVars.NATS_SERVERS,
};

export const DbEnvs = {
  dbPassword: envVars.DB_PASSWORD,
  dbDatabase: envVars.DB_DATABASE,
  dbHost: envVars.DB_HOST,
  dbPort: envVars.DB_PORT,
  dbUsername: envVars.DB_USERNAME,
};

export const FrontEnvs = {
  frontendServers: envVars.FRONTENDS_SERVERS,
};

export const PvtEnvs = {
  PvtBeApiServer: envVars.PVT_BE_API_SERVER + '/api/v1',
  PvtBackendApiServer: envVars.PVT_BACKEND_API_SERVER + '/api',
  PvtHashSecret: envVars.PVT_HASH_SECRET,
};

export const envsFtp = {
  ftpHost: envVars.FTP_HOST,
  ftpUsername: envVars.FTP_USERNAME,
  ftpPassword: envVars.FTP_PASSWORD,
  ftpRoot: envVars.FTP_ROOT,
  ftpSsl: envVars.FTP_SSL,
};
