import React from 'react';

function parseInline(text, keyPrefix = 'inline') {
  const segments = [];
  const pattern = /(!\[[^\]]*\]\([^\)]+\)|\[[^\]]+\]\([^\)]+\)|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match;
  let tokenIndex = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `${keyPrefix}-${tokenIndex}`;

    if (token.startsWith('![')) {
      const imageMatch = token.match(/^!\[([^\]]*)\]\(([^\)]+)\)$/);
      if (imageMatch) {
        segments.push(
          <img
            key={key}
            className="wiki-inline-image"
            src={imageMatch[2]}
            alt={imageMatch[1] || 'uploaded image'}
          />
        );
      } else {
        segments.push(token);
      }
    } else if (token.startsWith('[')) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^\)]+)\)$/);
      if (linkMatch) {
        segments.push(
          <a key={key} href={linkMatch[2]} target="_blank" rel="noreferrer">
            {linkMatch[1]}
          </a>
        );
      } else {
        segments.push(token);
      }
    } else if (token.startsWith('`')) {
      segments.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith('**')) {
      segments.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*')) {
      segments.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else {
      segments.push(token);
    }

    lastIndex = match.index + token.length;
    tokenIndex += 1;
  }

  if (lastIndex < text.length) {
    segments.push(text.slice(lastIndex));
  }

  return segments;
}

function renderList(lines, startIndex, ordered) {
  const items = [];
  let index = startIndex;
  const matcher = ordered ? /^\d+\.\s+(.*)$/ : /^[-*]\s+(.*)$/;

  while (index < lines.length) {
    const line = lines[index];
    const match = line.match(matcher);
    if (!match) break;

    const value = match[1];
    const checkboxMatch = value.match(/^\[( |x|X)\]\s+(.*)$/);
    if (checkboxMatch) {
      items.push(
        <li key={`item-${index}`} className="wiki-task-item">
          <input type="checkbox" checked={checkboxMatch[1].toLowerCase() === 'x'} readOnly />
          <span>{parseInline(checkboxMatch[2], `task-${index}`)}</span>
        </li>
      );
    } else {
      items.push(<li key={`item-${index}`}>{parseInline(value, `list-${index}`)}</li>);
    }

    index += 1;
  }

  const ListTag = ordered ? 'ol' : 'ul';
  return {
    node: <ListTag key={`list-${startIndex}`}>{items}</ListTag>,
    nextIndex: index
  };
}

export function renderMarkdown(markdownText) {
  if (!markdownText) return null;

  const lines = markdownText.replace(/\r\n/g, '\n').split('\n');
  const elements = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const codeFenceMatch = trimmed.match(/^```(.*)$/);
    if (codeFenceMatch) {
      const language = codeFenceMatch[1].trim();
      const codeLines = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      elements.push(
        <pre key={`code-${elements.length}`} className="wiki-code-block">
          {language && <div className="wiki-code-label">{language}</div>}
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const Tag = `h${level}`;
      elements.push(<Tag key={`heading-${elements.length}`}>{parseInline(headingMatch[2], `heading-${index}`)}</Tag>);
      index += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      elements.push(<hr key={`hr-${elements.length}`} className="wiki-rule" />);
      index += 1;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines = [];
      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        quoteLines.push(lines[index].replace(/^>\s?/, ''));
        index += 1;
      }
      elements.push(<blockquote key={`quote-${elements.length}`}>{renderMarkdown(quoteLines.join('\n'))}</blockquote>);
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const list = renderList(lines, index, false);
      elements.push(list.node);
      index = list.nextIndex;
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const list = renderList(lines, index, true);
      elements.push(list.node);
      index = list.nextIndex;
      continue;
    }

    const paragraphLines = [trimmed];
    index += 1;
    while (index < lines.length) {
      const nextTrimmed = lines[index].trim();
      if (
        !nextTrimmed ||
        /^```/.test(nextTrimmed) ||
        /^(#{1,6})\s+/.test(nextTrimmed) ||
        /^(-{3,}|\*{3,}|_{3,})$/.test(nextTrimmed) ||
        /^>\s?/.test(nextTrimmed) ||
        /^[-*]\s+/.test(nextTrimmed) ||
        /^\d+\.\s+/.test(nextTrimmed)
      ) {
        break;
      }
      paragraphLines.push(nextTrimmed);
      index += 1;
    }

    elements.push(
      <p key={`paragraph-${elements.length}`}>
        {parseInline(paragraphLines.join(' '), `paragraph-${index}`)}
      </p>
    );
  }

  return elements;
}