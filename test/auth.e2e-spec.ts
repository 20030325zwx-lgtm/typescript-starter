import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserStatus } from '@prisma/client';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/app.setup';
import { PrismaService } from '../src/database/prisma.service';
import {
  WECHAT_AUTH_CLIENT,
  type WechatAuthClient,
} from '../src/modules/wechat/wechat-auth-client.interface';
import { S3ObjectStorageService } from '../src/modules/storage/s3-object-storage.service';

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string };
}

describe('Authentication (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: Server;
  const wechatAuthClient: WechatAuthClient = {
    exchangeCode: jest.fn((code: string) =>
      Promise.resolve({ openid: `openid-${code}` }),
    ),
  };

  beforeAll(async () => {
    process.env.LOG_LEVEL = 'silent';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(WECHAT_AUTH_CLIENT)
      .useValue(wechatAuthClient)
      .overrideProvider(S3ObjectStorageService)
      .useValue({
        putPrivateObject: jest.fn(),
        deleteObject: jest.fn(),
        createPresignedGetUrl: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    configureApplication(app);
    await app.init();

    prisma = app.get(PrismaService);
    server = app.getHttpServer() as Server;
    await prisma.refreshSession.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.refreshSession.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  it('reports liveness and database readiness', async () => {
    await request(server).get('/api/v1/health/live').expect(200);
    await request(server).get('/api/v1/health/ready').expect(200);
  });

  it('validates the wechat login request', async () => {
    const response = await request(server)
      .post('/api/v1/auth/wechat-login')
      .send({ code: '' })
      .expect(400);

    expect(response.body as Record<string, unknown>).toMatchObject({
      code: 'VALIDATION_FAILED',
      message: '请求参数不正确',
    });
  });

  it('logs in, rotates refresh token, logs out and deletes the user', async () => {
    const login = await request(server)
      .post('/api/v1/auth/wechat-login')
      .send({ code: 'valid-code' })
      .expect(200);
    const firstTokens = login.body as AuthResponse;

    const currentUser = await request(server)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${firstTokens.accessToken}`)
      .expect(200);
    expect((currentUser.body as { id: string }).id).toBe(firstTokens.user.id);

    const refreshed = await request(server)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: firstTokens.refreshToken })
      .expect(200);
    const secondTokens = refreshed.body as AuthResponse;
    expect(secondTokens.refreshToken).not.toBe(firstTokens.refreshToken);

    const replay = await request(server)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: firstTokens.refreshToken })
      .expect(401);
    expect((replay.body as { code: string }).code).toBe(
      'AUTH_REFRESH_TOKEN_INVALID',
    );

    await request(server)
      .post('/api/v1/auth/logout')
      .send({ refreshToken: secondTokens.refreshToken })
      .expect(204);
    await request(server)
      .post('/api/v1/auth/logout')
      .send({ refreshToken: secondTokens.refreshToken })
      .expect(204);

    await request(server)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: secondTokens.refreshToken })
      .expect(401);

    await request(server)
      .delete('/api/v1/users/me')
      .set('Authorization', `Bearer ${secondTokens.accessToken}`)
      .expect(204);

    const user = await prisma.user.findUnique({
      where: { id: firstTokens.user.id },
    });
    expect(user?.status).toBe(UserStatus.DELETED);

    const deletedAccess = await request(server)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${secondTokens.accessToken}`)
      .expect(401);
    expect((deletedAccess.body as { code: string }).code).toBe(
      'AUTH_ACCESS_TOKEN_INVALID',
    );
  });

  it('allows only one concurrent refresh request to rotate a token', async () => {
    const login = await request(server)
      .post('/api/v1/auth/wechat-login')
      .send({ code: 'concurrent-code' })
      .expect(200);
    const tokens = login.body as AuthResponse;

    const responses = await Promise.all([
      request(server)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: tokens.refreshToken }),
      request(server)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: tokens.refreshToken }),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 401,
    ]);
  });
});
