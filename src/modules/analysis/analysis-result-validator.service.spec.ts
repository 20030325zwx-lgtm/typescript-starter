import { ConfigService } from '@nestjs/config';
import { AnalysisExecutionError } from './analysis-execution.error';
import { AnalysisResultValidatorService } from './analysis-result-validator.service';
import type { AnalysisOutput } from './analysis-output.types';

const validOutput: AnalysisOutput = {
  schema_version: '1.0',
  quality: { is_complete: true, needs_reupload: false, message: '' },
  question: {
    type_code: 'single_choice',
    text: '题干',
    options: [
      { label: 'A', text: '选项 A' },
      { label: 'B', text: '选项 B' },
    ],
    user_answer: 'A',
    correct_answer: 'B',
  },
  knowledge_points: [{ code: 'logic_strengthen', confidence: 0.9 }],
  diagnosis: {
    error_type: 'REASONING_ERROR',
    reason: '错误原因',
    confidence: 0.8,
    requires_user_confirmation: false,
  },
  solution: {
    summary: '解析',
    steps: ['第一步'],
    option_analysis: [{ label: 'A', analysis: '不成立' }],
    memory_tip: '记忆提示',
  },
  safety: { answer_confidence: 0.9, needs_manual_review: false },
};

describe('AnalysisResultValidatorService', () => {
  const config = {
    get: jest.fn((_key: string, fallback: number) => fallback),
  } as unknown as ConfigService;
  const service = new AnalysisResultValidatorService(config);
  const context = {
    schemaVersion: '1.0',
    userAnswer: 'A',
    candidateCodes: new Set(['logic_strengthen']),
  };

  it('accepts a valid contracted result', () => {
    expect(
      service.validate(structuredClone(validOutput), context),
    ).toMatchObject({ schema_version: '1.0' });
  });

  it('rejects a hallucinated knowledge-point code', () => {
    const output = structuredClone(validOutput);
    output.knowledge_points[0].code = 'not_in_catalog';

    expect(() => service.validate(output, context)).toThrow(
      AnalysisExecutionError,
    );
    try {
      service.validate(output, context);
    } catch (error: unknown) {
      expect(error).toMatchObject({ code: 'DIFY_KNOWLEDGE_POINT_INVALID' });
    }
  });

  it('forces manual review when answer confidence is below threshold', () => {
    const output = structuredClone(validOutput);
    output.safety.answer_confidence = 0.3;

    expect(service.validate(output, context).safety.needs_manual_review).toBe(
      true,
    );
  });

  it('rejects a model output that rewrites the supplied user answer', () => {
    const output = structuredClone(validOutput);
    output.question.user_answer = 'B';

    expect(() => service.validate(output, context)).toThrow(
      AnalysisExecutionError,
    );
    try {
      service.validate(output, context);
    } catch (error: unknown) {
      expect(error).toMatchObject({ code: 'DIFY_OUTPUT_INVALID' });
    }
  });

  it('allows an empty inferred user answer when none was supplied', () => {
    const output = structuredClone(validOutput);
    output.question.user_answer = '';

    expect(
      service.validate(output, { ...context, userAnswer: null }).question
        .user_answer,
    ).toBe('');
  });

  it('returns the model quality message for a non-question image', () => {
    const output = structuredClone(validOutput);
    output.quality = {
      is_complete: false,
      needs_reupload: true,
      message: '图片中未发现可分析的题目',
    };
    output.knowledge_points = [];

    expect(() =>
      service.validate(output, { ...context, userAnswer: null }),
    ).toThrow(AnalysisExecutionError);
    try {
      service.validate(output, { ...context, userAnswer: null });
    } catch (error: unknown) {
      expect(error).toMatchObject({
        code: 'IMAGE_REUPLOAD_REQUIRED',
        safeMessage: '图片中未发现可分析的题目',
      });
    }
  });

  it('clears an unverified inferred answer when the user supplied none', () => {
    const output = structuredClone(validOutput);
    output.question.user_answer = 'B';
    output.question.user_answer_evidence = '模型声称 B 被圈选';

    const result = service.validate(output, {
      ...context,
      userAnswer: null,
    });

    expect(result.question.user_answer).toBe('');
    expect(result.question.user_answer_evidence).toBe('');
    expect(result.diagnosis).toMatchObject({
      error_type: 'OTHER',
      requires_user_confirmation: true,
    });
  });

  it('normalizes a knowledge code used incorrectly as the question type', () => {
    const output = structuredClone(validOutput);
    output.question.type_code =
      'logic_strengthen' as AnalysisOutput['question']['type_code'];

    expect(
      service.validate(output, { ...context, userAnswer: null }).question
        .type_code,
    ).toBe('single_choice');
  });
});
