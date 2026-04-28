import 'dotenv/config';
import * as joi from 'joi';

interface EnvVars {
  PORT: number;
  NATS_SERVERS: string[];
  NATS_TOKEN: string;
  CORS_ALLOW_DOMAINS: string[];
  CORS_ALLOW_IPS: string[];
  CORS_ENV: string;
  HCAPTCHA_SECRET: string;
}

const envsSchema = joi
  .object({
    PORT: joi.number().required(),
    NATS_SERVERS: joi.array().items(joi.string()).required(),
    NATS_TOKEN: joi.string().required(),
    CORS_ALLOW_DOMAINS: joi.array().items(joi.string()).required(),
    CORS_ALLOW_IPS: joi.array().items(joi.string()).required(),
    CORS_ENV: joi.string().required(),
    HCAPTCHA_SECRET: joi.string().required(),
  })
  .unknown(true);

const { error, value } = envsSchema.validate({
  ...process.env,
  NATS_SERVERS: process.env.NATS_SERVERS?.split(','),
  CORS_ALLOW_DOMAINS: process.env.CORS_ALLOW_DOMAINS?.split(','),
  CORS_ALLOW_IPS: process.env.CORS_ALLOW_IPS?.split(','),
});

if (error) {
  throw new Error(`Config validation errors: ${error.message}`);
}

const envVars: EnvVars = value;

const isProd = envVars.CORS_ENV === 'production';

const getCorsOrigins = (corsOrigin: string[]): string[] => {
  const origins: string[] = [];

  corsOrigin.forEach((domain) => {

    origins.push(`http://${domain}`);
    origins.push(`https://${domain}`);

    if (!isProd && !domain.includes(':')) {
      origins.push(`http://${domain}:3000`);
      origins.push(`https://${domain}:3000`);
      origins.push(`http://${domain}:4200`);
      origins.push(`https://${domain}:4200`);
      origins.push(`http://${domain}:8080`);
      origins.push(`https://${domain}:8080`);
      origins.push(`http://${domain}:8081`);
      origins.push(`https://${domain}:8081`);
      origins.push(`http://${domain}:5173`);
      origins.push(`https://${domain}:5173`);
    }
  });

  return [...new Set(origins)];
};

export const envs = {
  port: envVars.PORT,
  corsEnv: envVars.CORS_ENV,
  // CORS configuration
  corsAllowedOriginDomains: getCorsOrigins(envVars.CORS_ALLOW_DOMAINS),
  corsAllowedOriginIPs:
    envVars.CORS_ENV === 'development'
      ? getCorsOrigins(envVars.CORS_ALLOW_IPS)
      : envVars.CORS_ALLOW_IPS,
  // NATS configuration
  natsServers: envVars.NATS_SERVERS,
  natsToken: envVars.NATS_TOKEN,
  // hCaptcha
  hcaptchaSecret: envVars.HCAPTCHA_SECRET,
};
