import { describe, expect, it } from 'vitest';
import { normalizeSuggestions } from './suggestions';

const item = (n, extra = {}) => ({
  type: 'question',
  preview: `preview ${n}`,
  internal_context: `context ${n}`,
  ...extra,
});

describe('normalizeSuggestions', () => {
  it('passes through exactly three valid suggestions', () => {
    const raw = { suggestions: [item(1), item(2), item(3)] };
    expect(normalizeSuggestions(raw)).toEqual([item(1), item(2), item(3)]);
  });

  it('pads to three with clarify fallbacks when the model returns fewer', () => {
    const result = normalizeSuggestions({ suggestions: [item(1)] });
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(item(1));
    for (const fallback of result.slice(1)) {
      expect(fallback.type).toBe('clarify');
      expect(fallback.preview).toEqual(expect.any(String));
      expect(fallback.preview.length).toBeGreaterThan(0);
    }
  });

  it('returns three fallbacks for missing, empty or malformed input', () => {
    for (const raw of [undefined, null, {}, { suggestions: [] }, { suggestions: 'nope' }]) {
      const result = normalizeSuggestions(raw);
      expect(result).toHaveLength(3);
      expect(result.every((s) => s.type === 'clarify')).toBe(true);
    }
  });

  it('truncates to the first three suggestions', () => {
    const raw = { suggestions: [item(1), item(2), item(3), item(4), item(5)] };
    expect(normalizeSuggestions(raw)).toEqual([item(1), item(2), item(3)]);
  });

  it('defaults the type to talking_point when it is missing or not a string', () => {
    const raw = {
      suggestions: [item(1, { type: undefined }), item(2, { type: 42 }), item(3)],
    };
    const result = normalizeSuggestions(raw);
    expect(result[0].type).toBe('talking_point');
    expect(result[1].type).toBe('talking_point');
    expect(result[2].type).toBe('question');
  });

  it('drops entries without a string preview before padding', () => {
    const raw = { suggestions: [null, { type: 'answer' }, { preview: 7 }, item(1)] };
    const result = normalizeSuggestions(raw);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(item(1));
    expect(result[1].type).toBe('clarify');
  });

  it('trims preview and internal_context and defaults missing context to empty', () => {
    const raw = {
      suggestions: [
        { type: 'answer', preview: '  hello  ', internal_context: '\n why \n' },
        { type: 'answer', preview: 'no context' },
      ],
    };
    const result = normalizeSuggestions(raw);
    expect(result[0]).toEqual({ type: 'answer', preview: 'hello', internal_context: 'why' });
    expect(result[1].internal_context).toBe('');
  });
});
