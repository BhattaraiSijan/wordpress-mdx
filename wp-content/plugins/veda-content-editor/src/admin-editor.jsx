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

// Import CSS explicitly
import '@mdxeditor/editor/style.css';

console.log('🚀 VEDA Story Editor with Save/Load functionality');

// Inject MDXEditor CSS if not already loaded
function injectMDXEditorCSS() {
    // Check if CSS is already loaded
    const existingLink = document.querySelector('link[href*="mdxeditor"]');
    if (existingLink) {
        console.log('✅ MDXEditor CSS already loaded');
        return;
    }
    
    // Create and inject CSS link
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/@mdxeditor/editor@latest/style.css';
    link.onload = () => console.log('✅ MDXEditor CSS loaded from CDN');
    link.onerror = () => console.warn('❌ Failed to load MDXEditor CSS from CDN');
    document.head.appendChild(link);
}

// Inject CSS when script loads
injectMDXEditorCSS();

function VEDAStoryEditor({ initialContent, postId, onSave }) {
    const [content, setContent] = React.useState(initialContent);
    const [saveStatus, setSaveStatus] = React.useState('ready'); // ready, saving, saved, error
    const [lastSaved, setLastSaved] = React.useState(null);
    const saveTimeoutRef = React.useRef(null);

    // Auto-save functionality
    const autoSave = React.useCallback(async (content) => {
        if (!content || content === initialContent) return;
        
        setSaveStatus('saving');
        
        try {
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
                console.log('✅ Auto-saved successfully');
            } else {
                setSaveStatus('error');
                console.error('❌ Auto-save failed:', result);
            }
        } catch (error) {
            setSaveStatus('error');
            console.error('❌ Auto-save error:', error);
        }
    }, [postId, initialContent]);

    // Manual save functionality
    const manualSave = React.useCallback(async () => {
        if (!content) return;
        
        setSaveStatus('saving');
        
        try {
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
                console.log('✅ Story saved successfully');
                
                // Update the hidden field for WordPress save
                const hiddenField = document.getElementById('veda_story_content_hidden');
                if (hiddenField) {
                    hiddenField.value = content;
                }
                
                // Update WordPress save status
                const statusDiv = document.getElementById('veda-save-status');
                if (statusDiv) {
                    statusDiv.innerHTML = '<span style="color: #00a32a;">✅ Saved at ' + new Date().toLocaleTimeString() + '</span>';
                }
            } else {
                setSaveStatus('error');
                console.error('❌ Save failed:', result);
            }
        } catch (error) {
            setSaveStatus('error');
            console.error('❌ Save error:', error);
        }
    }, [content, postId, onSave]);

    // Handle content changes
    const handleChange = React.useCallback((newContent) => {
        setContent(newContent);
        setSaveStatus('ready');
        
        // Update the hidden field for WordPress save
        const hiddenField = document.getElementById('veda_story_content_hidden');
        if (hiddenField) {
            hiddenField.value = newContent;
        }
        
        // Clear existing timeout
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        
        // Auto-save after 3 seconds of inactivity
        saveTimeoutRef.current = setTimeout(() => {
            autoSave(newContent);
        }, 3000);
        
        console.log('📝 Content changed:', newContent?.length || 0, 'characters');
    }, [autoSave]);

    // Save on Ctrl+S
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

    // Save status indicator
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
    console.log('📦 Container found:', !!container);
    
    if (!container) {
        console.warn('❌ Container #veda-editor-root not found');
        return;
    }

    console.log('✨ Initializing VEDA Story Editor with Save/Load');
    
    // Get data from container and WordPress
    const postId = parseInt(container.dataset.postId);
    const initialContent = window.vedaEditor?.currentContent || container.dataset.initial || '# New VEDA Story\n\nStart writing...';
    
    console.log('📖 Loading story for post ID:', postId);
    console.log('📝 Initial content length:', initialContent.length);

    const handleSave = (content) => {
        console.log('💾 Story saved, length:', content.length);
        
        // Update WordPress publish button to show saved state
        const publishButton = document.getElementById('publish');
        if (publishButton && !publishButton.classList.contains('button-primary-disabled')) {
            publishButton.value = 'Update Story';
        }
    };

    try {
        const root = createRoot(container);
        root.render(
            React.createElement(VEDAStoryEditor, {
                initialContent: initialContent,
                postId: postId,
                onSave: handleSave
            })
        );
        console.log('✅ VEDA Story Editor initialized successfully');
        
        // Clear the loading message
        container.style.minHeight = 'auto';
        
    } catch (error) {
        console.error('❌ Failed to initialize VEDA Story Editor:', error);
        container.innerHTML = `
            <div style="padding: 20px; background: #fee; border: 1px solid #f00; color: #800;">
                <strong>Editor Error:</strong> ${error.message}<br>
                <small>Check console for details.</small>
            </div>
        `;
    }
}

// Initialize when everything is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEditor);
} else {
    initEditor();
}

console.log('✅ VEDA Story Editor script loaded');