import React from 'react';

interface RichTakeawaysProps {
  text: string;
}

function renderInlineFormatting(line: string): React.ReactNode[] {
  // Matches ==highlight==, **bold**, or `code/phrase` safely without dangerouslySetInnerHTML
  const tokenRegex = /(==[^=]+==|\*\*[^*]+\*\*|`[^`]+`)/g;
  const parts = line.split(tokenRegex);

  return parts.map((part, idx) => {
    if (part.startsWith('==') && part.endsWith('==') && part.length > 4) {
      return (
        <mark
          key={idx}
          className="rounded-sm bg-[#F8E3A0]/80 px-1 py-0.5 text-[#221F18] dark:bg-[#B4862C]/35 dark:text-[#F8ECC9]"
        >
          {part.slice(2, -2)}
        </mark>
      );
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong
          key={idx}
          className="font-semibold text-[#1E1C18] dark:text-[#F5F2EB]"
        >
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <span
          key={idx}
          className="rounded-md bg-[#F2EDE4] px-1.5 py-0.5 font-mono text-[0.85em] text-[#2F5540] dark:bg-[#2A2722] dark:text-[#96C5AA]"
        >
          {part.slice(1, -1)}
        </span>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export const RichTakeaways: React.FC<RichTakeawaysProps> = ({ text }) => {
  const lines = text
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) return null;

  const blocks: { type: 'list' | 'paragraph'; items: string[] }[] = [];

  for (const line of lines) {
    const bulletMatch = line.match(/^\s*([-•*])\s+(.*)$/);
    if (bulletMatch) {
      const last = blocks[blocks.length - 1];
      if (last && last.type === 'list') {
        last.items.push(bulletMatch[2]);
      } else {
        blocks.push({ type: 'list', items: [bulletMatch[2]] });
      }
    } else {
      blocks.push({ type: 'paragraph', items: [line] });
    }
  }

  return (
    <div className="space-y-2 text-[14.5px] leading-relaxed text-[#46423A] dark:text-[#C8C2B8]">
      {blocks.map((block, bIdx) => {
        if (block.type === 'list') {
          return (
            <ul key={bIdx} className="space-y-1.5 pl-4">
              {block.items.map((item, iIdx) => (
                <li
                  key={iIdx}
                  className="relative pl-1 before:absolute before:-left-3.5 before:top-[0.62em] before:h-1.5 before:w-1.5 before:rounded-full before:bg-[#3D6B52]/60 dark:before:bg-[#7EB093]/65"
                >
                  {renderInlineFormatting(item)}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={bIdx} className="whitespace-pre-wrap">
            {renderInlineFormatting(block.items[0])}
          </p>
        );
      })}
    </div>
  );
};
