import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service';

describe('TokenService', () => {
  const configValues: Record<string, string | number> = {
    JWT_ACCESS_SECRET: 'test-access-secret-12345678901234567890',
    JWT_REFRESH_SECRET: 'test-refresh-secret-123456789012345678',
    JWT_ACCESS_TTL_SECONDS: 900,
    JWT_REFRESH_TTL_SECONDS: 2592000,
  };
  const config = {
    get: jest.fn((key: string, fallback?: unknown) =>
      key in configValues ? configValues[key] : fallback,
    ),
    getOrThrow: jest.fn((key: string) => configValues[key]),
  } as unknown as ConfigService;
  const service = new TokenService(new JwtService(), config);

  it('issues and verifies a refresh token', async () => {
    const pair = await service.issuePair('user-id', 'session-id');

    await expect(
      service.verifyRefreshToken(pair.refreshToken),
    ).resolves.toEqual(
      expect.objectContaining({
        sub: 'user-id',
        sid: 'session-id',
        typ: 'refresh',
      }),
    );
    expect(pair.accessTokenExpiresIn).toBe(900);
    expect(pair.refreshTokenExpiresIn).toBe(2592000);
  });

  it('rejects an access token as a refresh token', async () => {
    const pair = await service.issuePair('user-id', 'session-id');

    await expect(
      service.verifyRefreshToken(pair.accessToken),
    ).rejects.toMatchObject({ code: 'AUTH_REFRESH_TOKEN_INVALID' });
  });
});
