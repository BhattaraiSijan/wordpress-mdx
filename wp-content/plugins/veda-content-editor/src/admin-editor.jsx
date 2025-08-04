import React from 'react';
import { createRoot } from 'react-dom/client';
import { 
    MDXEditor,
    headingsPlugin,
    listsPlugin,
    quotePlugin,
    markdownShortcutPlugin,
    linkPlugin,
    imagePlugin,
    codeBlockPlugin,
    codeMirrorPlugin,
    toolbarPlugin,
    BoldItalicUnderlineToggles,
    CreateLink,
    InsertImage,
    ListsToggle,
    BlockTypeSelect,
    InsertCodeBlock,
    Separator
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';

function injectMDXEditorCSS() {
    const existingLink = document.querySelector('link[href*="mdxeditor"]');
    if (existingLink) return;
    
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/@mdxeditor/editor@latest/style.css';
    document.head.appendChild(link);
}

injectMDXEditorCSS();

function VEDAStoryEditor({ initialContent, postId, onSave }) {
    const [content, setContent] = React.useState(initialContent);
    const [saveStatus, setSaveStatus] = React.useState('ready');
    const [lastSaved, setLastSaved] = React.useState(null);
    const saveTimeoutRef = React.useRef(null);

    const autoSave = React.useCallback(async (content) => {
        if (!content || content === initialContent) return;
        
        setSaveStatus('saving');
        
        const response = await fetch(window.vedaEditor.ajaxUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                action: 'veda_auto_save',
                post_id: postId,
                content: content,
                nonce: window.vedaEditor.ajaxNonce
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            setSaveStatus('saved');
            setLastSaved(new Date());
        } else {
            setSaveStatus('error');
        }
    }, [postId, initialContent]);

    const manualSave = React.useCallback(async () => {
        if (!content) return;
        
        setSaveStatus('saving');
        
        const response = await fetch(window.vedaEditor.saveEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-WP-Nonce': window.vedaEditor.restNonce
            },
            body: JSON.stringify({
                post_id: postId,
                content: content
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            setSaveStatus('saved');
            setLastSaved(new Date());
            onSave?.(content);
            
            const hiddenField = document.getElementById('veda_story_content_hidden');
            if (hiddenField) {
                hiddenField.value = content;
            }
            
            const statusDiv = document.getElementById('veda-save-status');
            if (statusDiv) {
                statusDiv.innerHTML = '<span style="color: #00a32a;">✅ Saved at ' + new Date().toLocaleTimeString() + '</span>';
            }
        } else {
            setSaveStatus('error');
        }
    }, [content, postId, onSave]);

    const handleChange = React.useCallback((newContent) => {
        setContent(newContent);
        setSaveStatus('ready');
        
        const hiddenField = document.getElementById('veda_story_content_hidden');
        if (hiddenField) {
            hiddenField.value = newContent;
        }
        
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        
        saveTimeoutRef.current = setTimeout(() => {
            autoSave(newContent);
        }, 3000);
    }, [autoSave]);

    React.useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                manualSave();
            }
        };
        
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [manualSave]);

    const SaveStatusIndicator = () => {
        const getStatusText = () => {
            switch (saveStatus) {
                case 'saving': return '💾 Saving...';
                case 'saved': return `✅ Saved${lastSaved ? ' at ' + lastSaved.toLocaleTimeString() : ''}`;
                case 'error': return '❌ Save failed';
                default: return '📝 Ready';
            }
        };

        const getStatusColor = () => {
            switch (saveStatus) {
                case 'saving': return '#f0ad4e';
                case 'saved': return '#00a32a';
                case 'error': return '#dc3545';
                default: return '#666';
            }
        };

        return React.createElement('div', {
            style: {
                fontSize: '12px',
                color: getStatusColor(),
                marginBottom: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }
        }, [
            React.createElement('span', { key: 'status' }, getStatusText()),
            React.createElement('button', {
                key: 'save-btn',
                onClick: manualSave,
                disabled: saveStatus === 'saving',
                style: {
                    padding: '4px 8px',
                    fontSize: '11px',
                    border: '1px solid #ddd',
                    borderRadius: '3px',
                    background: '#f7f7f7',
                    cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer'
                }
            }, saveStatus === 'saving' ? 'Saving...' : 'Save Now (Ctrl+S)')
        ]);
    };

    return React.createElement('div', { 
        style: { 
            border: '1px solid #ddd',
            borderRadius: '4px',
            background: '#fff'
        } 
    }, [
        React.createElement(SaveStatusIndicator, { key: 'status' }),
        React.createElement(MDXEditor, {
            key: 'editor',
            markdown: content,
            onChange: handleChange,
            plugins: [
                headingsPlugin(),
                listsPlugin(),
                quotePlugin(),
                markdownShortcutPlugin(),
                linkPlugin(),
                imagePlugin(),
                codeBlockPlugin({ defaultCodeBlockLanguage: 'js' }),
                codeMirrorPlugin({ 
                    codeBlockLanguages: { 
                        js: 'JavaScript', 
                        jsx: 'JSX',
                        python: 'Python',
                        css: 'CSS',
                        html: 'HTML'
                    } 
                }),
                toolbarPlugin({
                    toolbarContents: () => React.createElement('div', {
                        style: { display: 'flex', gap: '4px', alignItems: 'center' }
                    }, [
                        React.createElement(BlockTypeSelect, { key: 'blocks' }),
                        React.createElement(Separator, { key: 'sep1' }),
                        React.createElement(BoldItalicUnderlineToggles, { key: 'format' }),
                        React.createElement(Separator, { key: 'sep2' }),
                        React.createElement(ListsToggle, { key: 'lists' }),
                        React.createElement(Separator, { key: 'sep3' }),
                        React.createElement(CreateLink, { key: 'link' }),
                        React.createElement(InsertImage, { key: 'image' }),
                        React.createElement(InsertCodeBlock, { key: 'code' })
                    ])
                })
            ],
            contentEditableClassName: 'veda-editor-content'
        })
    ]);
}

function initEditor() {
    const container = document.getElementById('veda-editor-root');
    if (!container) return;
    
    const postId = parseInt(container.dataset.postId);
    const initialContent = window.vedaEditor?.currentContent || container.dataset.initial || '# New VEDA Story\n\nStart writing...';

    const handleSave = (content) => {
        const publishButton = document.getElementById('publish');
        if (publishButton && !publishButton.classList.contains('button-primary-disabled')) {
            publishButton.value = 'Update Story';
        }
    };

    const root = createRoot(container);
    root.render(
        React.createElement(VEDAStoryEditor, {
            initialContent: initialContent,
            postId: postId,
            onSave: handleSave
        })
    );
    
    container.style.minHeight = 'auto';
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEditor);
} else {
    initEditor();
}