'use client';

import { Highlight, themes, type Language } from 'prism-react-renderer';
import { HighlightedText } from '@/components/highlighted-text';
import { useTheme } from '@/components/theme-provider';

interface CodeHighlightProps {
  code: string;
  language: Language;
  searchQuery?: string;
  showLineNumbers?: boolean;
  wrapLongLines?: boolean;
  className?: string;
}

export function CodeHighlight({
  code,
  language,
  searchQuery = '',
  showLineNumbers = true,
  wrapLongLines = false,
  className = '',
}: CodeHighlightProps) {
  const { isDark } = useTheme();

  return (
    <Highlight theme={isDark ? themes.vsDark : themes.vsLight} code={code} language={language}>
      {({ className: prismClassName, style, tokens, getLineProps, getTokenProps }) => (
        <pre
          className={`${prismClassName} overflow-auto font-mono text-[13px] leading-7 ${className}`}
          style={{ ...style, background: 'transparent' }}
        >
          {tokens.map((line, lineIndex) => {
            const lineProps = getLineProps({ line });
            return (
              <div
                key={lineIndex}
                {...lineProps}
                className={`${lineProps.className ?? ''} flex ${wrapLongLines ? 'min-w-0' : 'min-w-max'}`}
              >
                {showLineNumbers && (
                  <span className="mr-4 w-8 shrink-0 select-none text-right text-muted-foreground/45">
                    {lineIndex + 1}
                  </span>
                )}
                <span className={wrapLongLines ? 'min-w-0 whitespace-pre-wrap break-words' : 'whitespace-pre'}>
                  {line.map((token, tokenIndex) => {
                    const tokenProps = getTokenProps({ token });
                    return (
                      <span key={tokenIndex} {...tokenProps}>
                        <HighlightedText text={token.content} query={searchQuery} />
                      </span>
                    );
                  })}
                </span>
              </div>
            );
          })}
        </pre>
      )}
    </Highlight>
  );
}
