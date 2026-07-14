import { ConfigService } from '@nestjs/config';
import { AnalysisExecutionError } from './analysis-execution.error';
import { AnalysisResultValidatorService } from './analysis-result-validator.service';
import type { AnalysisOutput } from './analysis-output.types';

const validOutput: AnalysisOutput = {
  schema_version: '1.0',
  quality: { is_complete: true, needs_reupload: false, message: '' },
  question: {
    type_code: 'logic_strengthen',
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
});
