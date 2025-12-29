import React from 'react';
import './Wiki.css';

const MarkdownRenderer = ({ content, parseInline }) => {
    if (!content) return null;

    const lines = content.split('\n');
    const elements = lines.map((line, index) => {
        // Headers
        if (line.startsWith('# ')) return <h1 key={index}>{line.substring(2)}</h1>;
        if (line.startsWith('## ')) return <h2 key={index}>{line.substring(3)}</h2>;
        if (line.startsWith('### ')) return <h3 key={index}>{line.substring(4)}</h3>;

        // List items
        if (line.startsWith('- ')) {
            return (
                <ul key={index}>
                   <li>{parseInline(line.substring(2))}</li>
                </ul>
            );
        }

        // Blockquote
        if (line.startsWith('> ')) return <blockquote key={index}>{parseInline(line.substring(2))}</blockquote>;

        // Empty lines
        if (line.trim() === '') return <br key={index} />;

        return <p key={index}>{parseInline(line)}</p>;
    });

    return <div className="markdown-body">{elements}</div>;
  };

export default MarkdownRenderer;
