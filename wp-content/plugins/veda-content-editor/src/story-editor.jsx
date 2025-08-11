// src/story-editor.jsx
import React, { useState, useCallback } from 'react';
import { VEDAContentEditor } from 'dev-veda-content-editor';
import '@mdxeditor/editor/style.css';
import '@trussworks/react-uswds/lib/uswds.css';

console.log('[VEDA] entry loaded — running runtime checks');

function detectCreateRoot() {
  try {
    if (typeof window !== 'undefined' && window.ReactDOM && typeof window.ReactDOM.createRoot === 'function') {
      return function createRootShim(container) {
        const root = window.ReactDOM.createRoot(container);
        return root;
      };
    }
  } catch (e) {
  }

  if (typeof window !== 'undefined' && window.ReactDOM && typeof window.ReactDOM.render === 'function') {
    return function createRootFallback(container) {
      return {
        render: (el) => {
          window.ReactDOM.render(el, container);
        }
      };
    };
  }
  return null;
}

const createRootShim = detectCreateRoot();
if (!createRootShim) {
  console.warn('[VEDA] No ReactDOM.createRoot or ReactDOM.render detected on window. Ensure react/react-dom are provided to the page.');
} else {
  console.log('[VEDA] createRoot available via shim.');
}

function VEDAEditorHost({ initialContent, postId }) {
  const [content, setContent] = useState(initialContent || '# New VEDA Story\n\nStart writing...');
  const [saveStatus, setSaveStatus] = useState('ready');
  const [lastSaved, setLastSaved] = useState(null);
  const [error, setError] = useState(null);

  // Handle content changes
  const handleContentChange = useCallback((newContent) => {
    setContent(newContent);
    
    // Update hidden textarea for WordPress form submission
    const hidden = document.getElementById('veda_story_content_hidden');
    if (hidden) {
      hidden.value = newContent;
    }
  }, []);

  // Manual save function
  const manualSave = useCallback(async (contentToSave) => {
    if (!contentToSave) return;
    
    setSaveStatus('saving');
    try {
      const response = await fetch(window.vedaEditor?.saveEndpoint || window.vedaEditor?.ajaxUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': window.vedaEditor?.restNonce || ''
        },
        body: JSON.stringify({ 
          post_id: postId, 
          content: contentToSave 
        })
      });
      
      const result = await response.json();
      if (result?.success) {
        setSaveStatus('saved');
        setLastSaved(new Date());
        
        const statusDiv = document.getElementById('veda-save-status');
        if (statusDiv) {
          statusDiv.innerHTML = '<span style="color: #00a32a;">Saved at ' + new Date().toLocaleTimeString() + '</span>';
        }
      } else {
        setSaveStatus('error');
        console.error('Manual save returned error', result);
      }
    } catch (err) {
      setSaveStatus('error');
      console.error('Manual save failed', err);
    }
  }, [postId]);

  // Handle keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        manualSave(content);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [content, manualSave]);

  if (error) {
    return (
      <div style={{ padding: 20, border: '1px solid #dc3545', background: '#fff0f0', borderRadius: 6 }}>
        <h3 style={{ marginTop: 0, color: '#721c24' }}>VEDA Editor Error</h3>
        <p style={{ color: '#721c24' }}>There was an error while rendering the editor.</p>
        <details style={{ whiteSpace: 'pre-wrap' }}>
          <summary>Error details</summary>
          <pre>{String(error?.stack || error)}</pre>
        </details>
      </div>
    );
  }

  try {
    return (
      <div style={{ border: '1px solid #ddd', borderRadius: 4, background: '#fff' }}>
        {/* Save Status Bar */}
        <div style={{ 
          padding: 8, 
          fontSize: 12, 
          color: '#666', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderBottom: '1px solid #eee'
        }}>
          <span>
            {saveStatus === 'saving' ? 'Saving...' : 
             saveStatus === 'saved' ? `Saved${lastSaved ? ' at ' + lastSaved.toLocaleTimeString() : ''}` : 
             saveStatus === 'error' ? 'Save failed' : 'Ready'}
          </span>
          <button
            onClick={() => manualSave(content)}
            style={{ 
              padding: '4px 8px', 
              fontSize: 11, 
              border: '1px solid #ddd', 
              borderRadius: 3, 
              background: '#f7f7f7', 
              cursor: 'pointer' 
            }}
          >
            Save Now (Ctrl+S)
          </button>
        </div>

        {/* VEDA Content Editor */}
        <div style={{ minHeight: '400px' }}>
          <VEDAContentEditor
            value={content}
            onChange={handleContentChange}
            placeholder="Start writing your VEDA story..."
          />
        </div>
      </div>
    );
  } catch (err) {
    console.error('[VEDA] Error rendering VEDAContentEditor:', err);
    setError(err);
    return null;
  }
}

/* ---------- Main boot function ---------- */

function initEditorClient() {
  const container = document.getElementById('veda-editor-root');
  if (!container) {
    console.warn('[VEDA] Container #veda-editor-root not found');
    return;
  }

  // Read dataset and initial content that WP localized
  const postId = parseInt(container.dataset.postId, 10) || (window.vedaEditor?.postId) || NaN;
  const initialContent = (window.vedaEditor?.currentContent) || container.dataset.initial || '# New VEDA Story\n\nStart writing...';

  console.log('[VEDA] Initializing editor with postId:', postId);
  console.log('[VEDA] Initial content length:', initialContent.length);

  // Ensure hidden textarea exists
  let hidden = document.getElementById('veda_story_content_hidden');
  if (!hidden) {
    hidden = document.createElement('textarea');
    hidden.id = 'veda_story_content_hidden';
    hidden.name = 'veda_story_content';
    hidden.style.display = 'none';
    document.body.appendChild(hidden);
  }
  hidden.value = initialContent;

  // Create reactive host element
  const host = document.createElement('div');
  container.innerHTML = ''; // clear placeholder markup
  container.appendChild(host);

  if (!createRootShim) {
    container.innerHTML = '<div style="padding:20px;color:#721c24;background:#fff0f0;border:1px solid #dc3545;border-radius:6px;">ReactDOM not found — cannot initialize the editor. Ensure react & react-dom are enqueued.</div>';
    return;
  }

  // Create root and render the React tree
  const root = createRootShim(host);

  try {
    root.render(React.createElement(VEDAEditorHost, { 
      initialContent, 
      postId 
    }));
    console.log('[VEDA] Editor host mounted successfully');
  } catch (err) {
    console.error('[VEDA] root.render failed', err);
    container.innerHTML = `<div style="padding:20px;color:#721c24;background:#fff0f0;border:1px solid #dc3545;border-radius:6px;">Failed to initialize editor UI: ${String(err?.message || err)}</div>`;
  }
}

/* Initialize when DOM ready */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEditorClient);
} else {
  initEditorClient();
}

/* Expose for debugging */
window.VEDAEditor = {
  initEditor: initEditorClient
};