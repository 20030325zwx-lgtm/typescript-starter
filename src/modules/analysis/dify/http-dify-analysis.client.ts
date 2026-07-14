import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnalysisExecutionError } from '../analysis-execution.error';
import type {
  DifyAnalysisClient,
  DifyAnalysisInput,
  DifyAnalysisResult,
} from './dify-analysis-client.interface';

interface DifyResponse {
  workflow_run_id?: unknown;
  data?: { status?: unknown; outputs?: unknown; error?: unknown };
}

@Injectable()
export class HttpDifyAnalysisClient implements DifyAnalysisClient {
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly outputKey: string;

  constructor(config: ConfigService) {
    this.endpoint = `${config.getOrThrow<string>('DIFY_BASE_URL').replace(/\/$/, '')}/v1/workflows/run`;
    this.apiKey = config.get<string>('DIFY_ANALYSIS_API_KEY', '');
    this.timeoutMs = config.get<number>('DIFY_ANALYSIS_TIMEOUT_MS', 90000);
    this.outputKey = config.get<string>(
      'DIFY_ANALYSIS_OUTPUT_KEY',
      'analysis_result',
    );
  }

  async run(input: DifyAnalysisInput): Promise<DifyAnalysisResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          inputs: {
            image: [
              {
                type: 'image',
                transfer_method: 'remote_url',
                url: input.imageUrl,
              },
            ],
            user_answer: input.userAnswer ?? '',
            provided_correct_answer: input.correctAnswer ?? '',
            question_source: input.source ?? '',
            user_note: input.note ?? '',
            knowledge_point_candidates: JSON.stringify(
              input.knowledgePointCandidates,
            ),
            schema_version: input.schemaVersion,
            locale: 'zh-CN',
          },
          response_mode: 'blocking',
          user: `learn-app:${input.userId}`,
        }),
        signal: controller.signal,
      });
    } catch (error: unknown) {
      const timedOut = error instanceof Error && error.name === 'AbortError';
      throw new AnalysisExecutionError(
        timedOut ? 'DIFY_TIMEOUT' : 'DIFY_UNAVAILABLE',
        timedOut ? 'AI 分析超时，请稍后重试' : 'AI 分析服务暂时不可用',
        true,
        { cause: error },
      );
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 429) {
      throw new AnalysisExecutionError(
        'DIFY_RATE_LIMITED',
        'AI 分析请求较多，请稍后重试',
        true,
      );
    }
    if (!response.ok) {
      throw new AnalysisExecutionError(
        response.status >= 500 ? 'DIFY_UNAVAILABLE' : 'DIFY_REQUEST_REJECTED',
        'AI 分析服务暂时不可用',
        response.status >= 500,
      );
    }

    let payload: DifyResponse;
    try {
      payload = (await response.json()) as DifyResponse;
    } catch (error: unknown) {
      throw this.invalidOutput(error);
    }
    if (!payload.data || payload.data.status !== 'succeeded') {
      throw new AnalysisExecutionError(
        'DIFY_WORKFLOW_FAILED',
        'AI 分析未能完成，请稍后重试',
        false,
      );
    }
    if (!this.isRecord(payload.data.outputs)) {
      throw this.invalidOutput();
    }

    const rawOutputs = payload.data.outputs;
    return {
      runId:
        typeof payload.workflow_run_id === 'string'
          ? payload.workflow_run_id
          : null,
      rawOutputs,
      output: this.parseOutput(rawOutputs[this.outputKey]),
    };
  }

  private parseOutput(value: unknown): unknown {
    if (this.isRecord(value)) {
      return value;
    }
    if (typeof value !== 'string' || value.includes('```')) {
      throw this.invalidOutput();
    }
    try {
      const parsed: unknown = JSON.parse(value);
      if (!this.isRecord(parsed)) {
        throw this.invalidOutput();
      }
      return parsed;
    } catch (error: unknown) {
      if (error instanceof AnalysisExecutionError) {
        throw error;
      }
      throw this.invalidOutput(error);
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private invalidOutput(cause?: unknown): AnalysisExecutionError {
    return new AnalysisExecutionError(
      'DIFY_OUTPUT_INVALID',
      'AI 返回结果格式异常，请重新分析',
      false,
      { cause },
    );
  }
}
