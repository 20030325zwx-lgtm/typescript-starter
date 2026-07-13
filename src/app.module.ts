import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { environmentSchema } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { QuestionsModule } from './modules/questions/questions.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validationSchema: environmentSchema,
      validationOptions: { abortEarly: false },
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('LOG_LEVEL', 'info'),
          genReqId: (request, response) => {
            const incomingId = request.headers['x-request-id'];
            const requestId =
              typeof incomingId === 'string' && incomingId.length <= 128
                ? incomingId
                : randomUUID();
            response.setHeader('x-request-id', requestId);
            return requestId;
          },
          redact: {
            paths: [
              'req.headers.authorization',
              'req.body.code',
              'req.body.refreshToken',
              'config.WECHAT_APP_SECRET',
              'config.DATABASE_URL',
            ],
            censor: '[REDACTED]',
          },
        },
      }),
    }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    UsersModule,
    QuestionsModule,
  ],
})
export class AppModule {}
