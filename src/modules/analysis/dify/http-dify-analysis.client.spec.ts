import { ConfigService } from '@nestjs/config';
import { HttpDifyAnalysisClient } from './http-dify-analysis.client';

describe('HttpDifyAnalysisClient', () => {
  const values: Record<string, string | number> = {
    DIFY_BASE_URL: 'https://dify.example',
    DIFY_ANALYSIS_API_KEY: 'secret-key',
    DIFY_ANALYSIS_TIMEOUT_MS: 5000,
    DIFY_ANALYSIS_OUTPUT_KEY: 'analysis_result',
  };
  const config = {
    getOrThrow: jest.fn((key: string) => values[key]),
    get: jest.fn((key: string, fallback: unknown) => values[key] ?? fallback),
  } as unknown as ConfigService;
  let client: HttpDifyAnalysisClient;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    client = new HttpDifyAnalysisClient(config);
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => fetchSpy.mockRestore());

  it('sends the Dify file input as a remote-url image array', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          workflow_run_id: 'run-1',
          data: {
            status: 'succeeded',
            outputs: { analysis_result: JSON.stringify({ ok: true }) },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const result = await client.run({
      userId: 'user-1',
      imageUrl: 'https://storage.example/signed',
      userAnswer: 'A',
      correctAnswer: 'B',
      source: null,
      note: null,
      knowledgePointCandidates: [],
      schemaVersion: '1.0',
    });
    const init = fetchSpy.mock.calls[0][1];
    const body = JSON.parse(init.body as string) as {
      inputs: { image: unknown[] };
    };

    expect(body.inputs.image).toEqual([
      {
        type: 'image',
        transfer_method: 'remote_url',
        url: 'https://storage.example/signed',
      },
    ]);
    expect(result).toMatchObject({ runId: 'run-1', output: { ok: true } });
  });

  it('rejects markdown-wrapped model JSON', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            status: 'succeeded',
            outputs: { analysis_result: '```json\n{}\n```' },
          },
        }),
        { status: 200 },
      ),
    );

    await expect(
      client.run({
        userId: 'user-1',
        imageUrl: 'https://storage.example/signed',
        userAnswer: null,
        correctAnswer: null,
        source: null,
        note: null,
        knowledgePointCandidates: [],
        schemaVersion: '1.0',
      }),
    ).rejects.toMatchObject({ code: 'DIFY_OUTPUT_INVALID' });
  });

  it('classifies rate limiting as retryable', async () => {
    fetchSpy.mockResolvedValue(new Response('', { status: 429 }));

    await expect(
      client.run({
        userId: 'user-1',
        imageUrl: 'https://storage.example/signed',
        userAnswer: null,
        correctAnswer: null,
        source: null,
        note: null,
        knowledgePointCandidates: [],
        schemaVersion: '1.0',
      }),
    ).rejects.toMatchObject({ code: 'DIFY_RATE_LIMITED', retryable: true });
  });
});
