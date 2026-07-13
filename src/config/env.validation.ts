import * as Joi from 'joi';

const secret = Joi.string().min(32).required();

export const environmentSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'staging', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),
  JWT_ACCESS_SECRET: secret,
  JWT_REFRESH_SECRET: secret,
  WECHAT_OPENID_HASH_SECRET: secret,
  TOKEN_HASH_SECRET: secret,
  JWT_ACCESS_TTL_SECONDS: Joi.number()
    .integer()
    .min(60)
    .max(86400)
    .default(900),
  JWT_REFRESH_TTL_SECONDS: Joi.number()
    .integer()
    .min(3600)
    .max(31536000)
    .default(2592000),
  WECHAT_APP_ID: Joi.string().min(1).required(),
  WECHAT_APP_SECRET: Joi.string().min(1).required(),
  WECHAT_API_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .max(30000)
    .default(5000),
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .default('info'),
  CORS_ORIGINS: Joi.string().allow('').default(''),
}).custom((value: Record<string, unknown>, helpers) => {
  const secrets = [
    value.JWT_ACCESS_SECRET,
    value.JWT_REFRESH_SECRET,
    value.WECHAT_OPENID_HASH_SECRET,
    value.TOKEN_HASH_SECRET,
  ];

  if (new Set(secrets).size !== secrets.length) {
    return helpers.error('any.custom', {
      message: 'JWT and hashing secrets must be different values',
    });
  }

  return value;
});
