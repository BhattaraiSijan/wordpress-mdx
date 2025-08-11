import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { evaluate } from '@mdx-js/mdx';
import * as runtime from 'react/jsx-runtime';

console.log('[VEDA] Story renderer loaded');

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

function StoryRenderer({ mdxContent, postId }) {
  const [mdxModule, setMdxModule] = useState(null);
  const [loadedContent, setLoadedContent] = useState(mdxContent);
  const [loading, setLoading] = useState(!mdxContent);
  const [error, setError] = useState(null);
  // If no content provided, try to fetch it from WordPress
  useEffect(() => {
    const fetchContent = async () => {
      if (mdxContent || !postId) {
        setLoading(false);
        return;
      }

      console.log('[VEDA] No content provided, attempting to fetch from WordPress...');
      console.log('[VEDA] Post ID:', postId);
      console.log('[VEDA] Available data sources:', {
        vedaStoryData: window.vedaStoryData,
        vedaEditor: window.vedaEditor,
        postData: window.postData
      });

      try {
        // Try multiple sources for content
        let content = null;

        // Source 1: vedaStoryData (preferred)
        if (window.vedaStoryData?.content) {
          content = window.vedaStoryData.content;
          console.log('[VEDA] Using vedaStoryData.content');
        }
        // Source 2: vedaEditor (fallback)
        else if (window.vedaEditor?.currentContent) {
          content = window.vedaEditor.currentContent;
          console.log('[VEDA] Using vedaEditor.currentContent');
        }
        // Source 3: Fetch from REST API
        else if (postId && window.vedaStoryData?.restNonce) {
          console.log('[VEDA] Attempting REST API fetch...');
          const response = await fetch(`/wp-json/wp/v2/posts/${postId}?_wpnonce=${window.vedaStoryData.restNonce}`);
          
          if (response.ok) {
            const postData = await response.json();
            content = postData.meta?.veda_story_content || postData.content?.rendered;
            console.log('[VEDA] Fetched from REST API');
          }
        }
        // Source 4: Try AJAX endpoint
        else if (postId && window.vedaStoryData?.ajaxUrl) {
          console.log('[VEDA] Attempting AJAX fetch...');
          const formData = new FormData();
          formData.append('action', 'get_veda_story_content');
          formData.append('post_id', postId);

          const response = await fetch(window.vedaStoryData.ajaxUrl, {
            method: 'POST',
            body: formData
          });
          
          if (response.ok) {
            const result = await response.json();
            if (result.success) {
              content = result.data;
              console.log('[VEDA] Fetched from AJAX endpoint');
            }
          }
        }

        if (content) {
          setLoadedContent(content);
          console.log('[VEDA] Content loaded, length:', content.length);
          console.log('[VEDA] Content preview:', content.substring(0, 200) + '...');
        } else {
          throw new Error('No content found from any source');
        }
      } catch (err) {
        console.error('[VEDA] Failed to fetch content:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [mdxContent, postId]);

  // Evaluate MDX when content is available
  useEffect(() => {
    if (!loadedContent) return;

    const evaluateMdx = async () => {
      try {
        console.log('[VEDA] Evaluating MDX content...');
        const mod = await evaluate(loadedContent, {
          ...runtime,
          useMDXComponents: () => availableComponents,
        });
        setMdxModule(mod);
        console.log('[VEDA] MDX evaluation successful');
      } catch (error) {
        console.error('[VEDA] Failed to evaluate MDX:', error);
        const ErrorComponent = () => (
          <div style={{ 
            padding: '20px', 
            border: '1px solid #dc3545', 
            background: '#fff0f0', 
            borderRadius: '6px',
            margin: '20px 0'
          }}>
            <h3 style={{ marginTop: 0, color: '#721c24' }}>MDX Rendering Error</h3>
            <pre style={{ color: '#721c24', whiteSpace: 'pre-wrap', fontSize: '14px' }}>
              {error.message}
            </pre>
            <details>
              <summary>Content that failed to render:</summary>
              <pre style={{ fontSize: '12px', background: '#f8f8f8', padding: '10px', marginTop: '10px' }}>
                {loadedContent}
              </pre>
            </details>
          </div>
        );
        setMdxModule({ default: ErrorComponent });
      }
    };

    evaluateMdx();
  }, [loadedContent]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <p>Loading VEDA story content...</p>
        <small style={{ color: '#666' }}>Post ID: {postId}</small>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: '20px', 
        border: '1px solid #dc3545', 
        background: '#fff0f0', 
        borderRadius: '6px',
        margin: '20px 0'
      }}>
        <h3 style={{ marginTop: 0, color: '#721c24' }}>Failed to Load Content</h3>
        <p style={{ color: '#721c24' }}>{error.message}</p>
        <details>
          <summary>Debug Information</summary>
          <pre style={{ fontSize: '12px', marginTop: '10px' }}>
            {JSON.stringify({
              postId,
              hasVedaStoryData: !!window.vedaStoryData,
              hasVedaEditor: !!window.vedaEditor,
              vedaStoryDataContent: window.vedaStoryData?.content ? 'Present' : 'Missing',
              vedaEditorContent: window.vedaEditor?.currentContent ? 'Present' : 'Missing'
            }, null, 2)}
          </pre>
        </details>
      </div>
    );
  }

  if (!mdxModule) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <p>Rendering content...</p>
      </div>
    );
  }

  const MdxComponent = mdxModule.default;
  return (
    <div className="veda-story-content">
      <MdxComponent />
    </div>
  );
}

// Initialize renderer
function initRenderer() {
  const container = document.getElementById('veda-story-root');
  
  if (!container) {
    console.warn('[VEDA] Container #veda-story-root not found');
    return;
  }

  // Get content from multiple possible sources
  const content = window.vedaStoryData?.content || 
                 window.vedaEditor?.currentContent || 
                 container.dataset.content || 
                 '';

  // Get post ID from multiple sources
  const postId = parseInt(container.dataset.postId, 10) || 
                parseInt(window.vedaStoryData?.postId, 10) || 
                parseInt(window.vedaEditor?.postId, 10) ||
                null;

  console.log('[VEDA] Renderer initialization:', {
    hasContainer: !!container,
    contentLength: content.length,
    postId: postId,
    sources: {
      vedaStoryData: !!window.vedaStoryData,
      vedaEditor: !!window.vedaEditor,
      containerData: !!container.dataset.content
    }
  });

  try {
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <StoryRenderer mdxContent={content} postId={postId} />
      </React.StrictMode>
    );
    console.log('[VEDA] Renderer mounted successfully');
  } catch (err) {
    console.error('[VEDA] Failed to mount renderer:', err);
    container.innerHTML = `
      <div style="padding:20px;color:#721c24;background:#fff0f0;border:1px solid #dc3545;border-radius:6px;">
        <strong>VEDA Renderer Error:</strong> ${err.message}
      </div>
    `;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRenderer);
} else {
  initRenderer();
}