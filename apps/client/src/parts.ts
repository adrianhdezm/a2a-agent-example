import type { Part } from '@a2a-js/sdk';
import type { Style } from './style.ts';

/** One part as text: text as it is, a link or raw bytes described, data as indented JSON. */
export function renderPart(part: Part, style: Style): string | undefined {
  const content = part.content;
  const type = part.mediaType === '' ? '' : `, ${part.mediaType}`;
  switch (content?.$case) {
    case 'text':
      return content.value;
    case 'url':
      return `${style('blue', '[link]')} ${content.value}${style('dim', type)}`;
    case 'raw':
      return style('blue', `[${String(content.value.length)} bytes${type}${part.filename === '' ? '' : `, ${part.filename}`}]`);
    case 'data':
      return `${style('yellow', '[data]')}\n${JSON.stringify(content.value, undefined, 2)}`;
    default:
      return undefined;
  }
}

/** Every part, one after the other; parts with nothing to show are left out. */
export function renderParts(parts: readonly Part[] | undefined, style: Style): string {
  return (parts ?? []).flatMap((part) => renderPart(part, style) ?? []).join('\n');
}
