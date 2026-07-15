import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import { AdminAuthService } from './admin-auth.service';

describe('AdminAuthService', () => {
  const values: Record<string, unknown> = {
    ADMIN_ENABLED: true,
    ADMIN_USERNAME: 'operator',
    ADMIN_PASSWORD: 'a-long-admin-password',
    ADMIN_JWT_SECRET: 'admin-secret-value-that-is-long-enough',
    ADMIN_JWT_TTL_SECONDS: 28800,
  };
  const config = {
    get: jest.fn((key: string, fallback?: unknown) => values[key] ?? fallback),
    getOrThrow: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
  const signAsync = jest.fn().mockResolvedValue('admin-token');
  const jwt = { signAsync } as unknown as JwtService;

  beforeEach(() => {
    values.ADMIN_ENABLED = true;
    jest.clearAllMocks();
  });

  it('rejects login when the management console is disabled', async () => {
    values.ADMIN_ENABLED = false;
    const service = new AdminAuthService(config, jwt);

    await expect(
      service.login({
        username: 'operator',
        password: 'a-long-admin-password',
      }),
    ).rejects.toMatchObject({ code: 'ADMIN_DISABLED' });
  });

  it('rejects invalid credentials without signing a token', async () => {
    const service = new AdminAuthService(config, jwt);

    await expect(
      service.login({ username: 'operator', password: 'wrong-password' }),
    ).rejects.toMatchObject({
      code: 'ADMIN_CREDENTIALS_INVALID',
    });
    expect(signAsync).not.toHaveBeenCalled();
  });

  it('issues an isolated admin token for valid credentials', async () => {
    const service = new AdminAuthService(config, jwt);

    await expect(
      service.login({
        username: 'operator',
        password: 'a-long-admin-password',
      }),
    ).resolves.toEqual({
      accessToken: 'admin-token',
      expiresIn: 28800,
      username: 'operator',
    });
    expect(signAsync).toHaveBeenCalledWith(
      { sub: 'operator', typ: 'admin' },
      expect.objectContaining({ expiresIn: 28800 }),
    );
  });
});
