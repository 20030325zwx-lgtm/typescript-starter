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
  S3_ENDPOINT: Joi.string().uri().required(),
  S3_REGION: Joi.string().min(1).default('us-east-1'),
  S3_ACCESS_KEY: Joi.string().min(1).required(),
  S3_SECRET_KEY: Joi.string().min(8).required(),
  S3_BUCKET: Joi.string()
    .pattern(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/)
    .required(),
  S3_FORCE_PATH_STYLE: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),
  S3_PRESIGNED_URL_TTL_SECONDS: Joi.number()
    .integer()
    .min(60)
    .max(3600)
    .default(300),
  UPLOAD_MAX_FILE_SIZE_BYTES: Joi.number()
    .integer()
    .min(1048576)
    .max(20971520)
    .default(10485760),
  UPLOAD_MAX_PIXELS: Joi.number()
    .integer()
    .min(1000000)
    .max(100000000)
    .default(40000000),
  UPLOAD_DAILY_LIMIT: Joi.number().integer().min(1).max(1000).default(30),
  REDIS_URL: Joi.string()
    .uri({ scheme: ['redis', 'rediss'] })
    .required(),
  ANALYSIS_QUEUE_NAME: Joi.string().min(1).max(100).default('analysis'),
  ANALYSIS_QUEUE_ATTEMPTS: Joi.number().integer().min(1).max(10).default(3),
  ANALYSIS_QUEUE_CONCURRENCY: Joi.number().integer().min(1).max(20).default(1),
  ANALYSIS_RECONCILE_INTERVAL_MS: Joi.number()
    .integer()
    .min(5000)
    .max(3600000)
    .default(30000),
  ANALYSIS_WORKER_ENABLED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),
  ANALYSIS_IDEMPOTENCY_SECRET: secret,
  DIFY_BASE_URL: Joi.string().uri().required(),
  DIFY_ANALYSIS_API_KEY: Joi.string().allow('').default(''),
  DIFY_ANALYSIS_TIMEOUT_MS: Joi.number()
    .integer()
    .min(5000)
    .max(300000)
    .default(90000),
  DIFY_ANALYSIS_OUTPUT_KEY: Joi.string()
    .min(1)
    .max(100)
    .default('analysis_result'),
  DIFY_ANALYSIS_WORKFLOW_VERSION: Joi.string().min(1).max(64).required(),
  DIFY_ANALYSIS_PROMPT_VERSION: Joi.string().min(1).max(64).required(),
  DIFY_ANALYSIS_MODEL_NAME: Joi.string().min(1).max(100).required(),
  DIFY_ANALYSIS_SCHEMA_VERSION: Joi.string().valid('1.0').default('1.0'),
  DIFY_KNOWLEDGE_BASE_VERSION: Joi.string().allow('').max(64).default(''),
  DIFY_ANSWER_CONFIDENCE_THRESHOLD: Joi.number().min(0).max(1).default(0.8),
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
    value.ANALYSIS_IDEMPOTENCY_SECRET,
  ];

  if (new Set(secrets).size !== secrets.length) {
    return helpers.error('any.custom', {
      message: 'JWT and hashing secrets must be different values',
    });
  }

  if (value.ANALYSIS_WORKER_ENABLED && !value.DIFY_ANALYSIS_API_KEY) {
    return helpers.error('any.custom', {
      message: 'DIFY_ANALYSIS_API_KEY is required when the worker is enabled',
    });
  }

  return value;
});
