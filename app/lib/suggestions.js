export function normalizeSuggestions(raw) {
  const list = Array.isArray(raw?.suggestions) ? raw.suggestions : [];
  const cleaned = list
    .filter((s) => s && typeof s.preview === 'string')
    .map((s) => ({
      type: typeof s.type === 'string' ? s.type : 'talking_point',
      preview: s.preview.trim(),
      internal_context:
        typeof s.internal_context === 'string'
          ? s.internal_context.trim()
          : '',
    }));

  while (cleaned.length < 3) {
    cleaned.push({
      type: 'clarify',
      preview:
        'Audio slice was thin—ask one clarifying question about the last decision or number mentioned.',
      internal_context: 'Fallback slot because the model returned fewer than 3 items.',
    });
  }

  return cleaned.slice(0, 3);
}
