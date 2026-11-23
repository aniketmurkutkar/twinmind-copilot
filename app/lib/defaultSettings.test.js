import { describe, expect, it } from 'vitest';
import { applyTemplate, sliceTranscriptByWords } from './defaultSettings';

describe('sliceTranscriptByWords', () => {
  it('returns the whole transcript when it is under the limit', () => {
    expect(sliceTranscriptByWords('one two three', 5)).toBe('one two three');
  });

  it('returns the whole transcript when it is exactly at the limit', () => {
    expect(sliceTranscriptByWords('one two three', 3)).toBe('one two three');
  });

  it('keeps only the most recent words when over the limit', () => {
    expect(sliceTranscriptByWords('one two three four five', 2)).toBe('four five');
  });

  it('collapses runs of whitespace, tabs and newlines into single spaces', () => {
    expect(sliceTranscriptByWords('  one\n\ntwo\t three   ', 10)).toBe('one two three');
    expect(sliceTranscriptByWords('one \n two \t three', 2)).toBe('two three');
  });

  it('returns an empty string for empty or whitespace-only input', () => {
    expect(sliceTranscriptByWords('', 10)).toBe('');
    expect(sliceTranscriptByWords('   \n\t ', 10)).toBe('');
    expect(sliceTranscriptByWords(null, 10)).toBe('');
    expect(sliceTranscriptByWords(undefined, 10)).toBe('');
  });

  it('returns an empty string when the limit is missing, zero or negative', () => {
    expect(sliceTranscriptByWords('one two', 0)).toBe('');
    expect(sliceTranscriptByWords('one two', -3)).toBe('');
    expect(sliceTranscriptByWords('one two', undefined)).toBe('');
  });
});

describe('applyTemplate', () => {
  it('replaces every occurrence of a repeated placeholder', () => {
    expect(applyTemplate('{{NAME}} and {{NAME}} again', { NAME: 'Ada' })).toBe(
      'Ada and Ada again'
    );
  });

  it('replaces several different placeholders', () => {
    expect(
      applyTemplate('Q: {{QUESTION}}\nT: {{TRANSCRIPT}}', {
        QUESTION: 'why?',
        TRANSCRIPT: 'because',
      })
    ).toBe('Q: why?\nT: because');
  });

  it('leaves placeholders without a matching variable untouched', () => {
    expect(applyTemplate('Hi {{NAME}}, see {{OTHER}}', { NAME: 'Ada' })).toBe(
      'Hi Ada, see {{OTHER}}'
    );
  });

  it('substitutes an empty string for null or undefined values', () => {
    expect(applyTemplate('[{{A}}][{{B}}]', { A: null, B: undefined })).toBe('[][]');
  });

  it('ignores variables that do not appear in the template', () => {
    expect(applyTemplate('plain text', { UNUSED: 'x' })).toBe('plain text');
  });

  it('does not treat replacement values as patterns', () => {
    expect(applyTemplate('{{T}}', { T: '$& {{T}} $1' })).toBe('$& {{T}} $1');
  });
});
