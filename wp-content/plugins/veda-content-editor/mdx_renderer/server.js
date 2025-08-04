import express from 'express';
import { evaluate } from '@mdx-js/mdx';
import * as runtime from 'react/jsx-runtime';
import { renderToString } from 'react-dom/server';
import React from 'react';

const Highlight = ({ color = 'yellow', children }) => {
  const style = {
    backgroundColor: color,
    padding: '2px 5px',
    borderRadius: '3px',
    color: '#111',
  };
  return React.createElement('span', { style }, children);
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
  return React.createElement('blockquote', { style: blockquoteStyle }, 
    React.createElement('p', null, children),
    React.createElement('footer', { style: footerStyle }, `— ${author}`)
  );
};

const availableComponents = {
  Highlight,
  CustomQuote,
};


const app = express();
app.use(express.json({ limit: '5mb' })); 

app.post('/render', async (req, res) => {
  const { mdxContent } = req.body;
  if (!mdxContent) {
    return res.status(400).send({ error: 'Missing mdxContent in request body.' });
  }

  try {
    const { default: MdxComponent } = await evaluate(mdxContent, {
      ...runtime,
      useMDXComponents: () => availableComponents, 
    });
    
    const html = renderToString(React.createElement(MdxComponent));
    
    res.send({ html });

  } catch (error) {
    console.error('MDX Rendering Error:', error);
    res.status(500).send({ error: 'Failed to render MDX.', details: error.message });
  }
});

const PORT = 4000;
app.listen(PORT, () => console.log(`✅ VEDA MDX rendering service is running on http://localhost:${PORT}`));