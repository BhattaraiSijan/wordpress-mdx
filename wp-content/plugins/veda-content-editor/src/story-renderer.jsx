import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { evaluate } from '@mdx-js/mdx';
import * as runtime from 'react/jsx-runtime';

const Highlight = ({ color = 'yellow', children }) => {
  const style = {
    backgroundColor: color,
    padding: '2px 5px',
    borderRadius: '3px',
    color: '#111',
  };
  return <span style={style}>{children}</span>;
};

const CustomQuote = ({ author, children }) => {
  const blockquoteStyle = {
    borderLeft: '4px solid #ccc',
    paddingLeft: '16px',
    margin: '16px 0',
    fontStyle: 'italic',
  };
  const footerStyle = {
    textAlign: 'right',
    fontWeight: 'bold',
    fontStyle: 'normal',
    marginTop: '8px',
  };
  return (
    <blockquote style={blockquoteStyle}>
      <p>{children}</p>
      <footer style={footerStyle}>— {author}</footer>
    </blockquote>
  );
};

const availableComponents = {
  Highlight,
  CustomQuote,
};
function StoryRenderer({ mdxContent }) {
  const [mdxModule, setMdxModule] = useState(null);

  useEffect(() => {
    const evaluateMdx = async () => {
      try {
        const mod = await evaluate(mdxContent, {
          ...runtime,
          useMDXComponents: () => availableComponents,
        });
        setMdxModule(mod);
      } catch (error) {
        console.error('Failed to evaluate MDX:', error);
        const ErrorComponent = () => <pre style={{ color: 'red' }}>{error.message}</pre>;
        setMdxModule({ default: ErrorComponent });
      }
    };
    evaluateMdx();
  }, [mdxContent]);

  if (!mdxModule) {
    return <p style={{ textAlign: 'center', padding: '40px' }}>Rendering Content...</p>;
  }

  const MdxComponent = mdxModule.default;
  return <MdxComponent />;
}

const container = document.getElementById('veda-story-root');

const content = window.vedaStoryData?.content || '';

if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <StoryRenderer mdxContent={content} />
    </React.StrictMode>
  );
}