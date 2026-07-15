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

  function mockSuccessfulFileUploadAndWorkflow(
    output = JSON.stringify({ ok: true }),
  ) {
    fetchSpy
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { 'content-type': 'image/png' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'file-1' }), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            workflow_run_id: 'run-1',
            data: {
              status: 'succeeded',
              outputs: { analysis_result: output },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
  }

  it('uploads the private image to Dify before running the workflow', async () => {
    mockSuccessfulFileUploadAndWorkflow();

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
    expect(fetchSpy.mock.calls[0][0]).toBe('https://storage.example/signed');
    expect(fetchSpy.mock.calls[1][0]).toBe(
      'https://dify.example/v1/files/upload',
    );
    const init = fetchSpy.mock.calls[2][1];
    const body = JSON.parse(init.body as string) as {
      inputs: { image: unknown[] };
    };

    expect(body.inputs.image).toEqual([
      {
        type: 'image',
        transfer_method: 'local_file',
        upload_file_id: 'file-1',
      },
    ]);
    expect(result).toMatchObject({ runId: 'run-1', output: { ok: true } });
  });

  it('accepts a single markdown-wrapped JSON object from the model', async () => {
    mockSuccessfulFileUploadAndWorkflow('```json\n{}\n```');

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
    ).resolves.toMatchObject({ output: {} });
  });

  it('classifies rate limiting as retryable', async () => {
    fetchSpy
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1]), {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
        }),
      )
      .mockResolvedValueOnce(new Response('', { status: 429 }));

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
