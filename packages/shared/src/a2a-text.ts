import type { Part } from '@a2a-js/sdk';

/** A plain-text A2A 1.0 part. */
export function textPart(text: string): Part {
  return { content: { $case: 'text', value: text }, metadata: undefined, filename: '', mediaType: 'text/plain' };
}

/** The text of some parts, one line per text part; parts that are not text are left out. */
export function partsText(parts: readonly Part[] | undefined): string {
  return (parts ?? []).flatMap(({ content }) => (content?.$case === 'text' ? [content.value] : [])).join('\n');
}
