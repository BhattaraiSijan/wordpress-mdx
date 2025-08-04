<?php
/**
 * Plugin Name: VEDA Story Editor
 * Description: UI-only editor for VEDA Stories using MDX Editor.
 * Version: 1.3 
 */

require_once plugin_dir_path(__FILE__) . 'post-type.php';

add_action('admin_enqueue_scripts', function ($hook) {
    global $post;
    
    if ('post.php' !== $hook && 'post-new.php' !== $hook) return;
    if (!isset($post) || $post->post_type !== 'veda_story') return;

    $plugin_dir_path = plugin_dir_path(__FILE__);
    $plugin_dir_url = plugin_dir_url(__FILE__);
    $js_file_path = $plugin_dir_path . 'dist/admin-editor-build.js';
    $css_file_path = $plugin_dir_path . 'dist/admin-editor-build.css';
    
    wp_enqueue_script(
        'veda-editor', 
        $plugin_dir_url . 'dist/admin-editor-build.js',
        ['wp-api-fetch'], 
        filemtime($js_file_path), 
        true
    );
    
    wp_localize_script('veda-editor', 'vedaEditor', [
        'postId' => $post->ID,
        'restNonce' => wp_create_nonce('wp_rest'),
        'ajaxNonce' => wp_create_nonce('veda_editor_nonce'),
        'ajaxUrl' => admin_url('admin-ajax.php'),
        'currentContent' => get_post_meta($post->ID, '_veda_story_content', true) ?: ''
    ]);

    if (file_exists($css_file_path)) {
        wp_enqueue_style(
            'veda-editor-style',
            $plugin_dir_url . 'dist/admin-editor-build.css',
            [],
            filemtime($css_file_path) 
        );
    }
});

add_action('edit_form_after_title', function ($post) { 
    if ($post->post_type !== 'veda_story') return;

    $saved_content = get_post_meta($post->ID, '_veda_story_content', true);
    $initial_content = $saved_content ?: '# ' . ($post->post_title ?: 'New VEDA Story') . '\n\nStart writing your story...';

    echo '<div id="veda-editor-root" 
               data-post-id="' . esc_attr($post->ID) . '"
               data-initial="' . esc_attr($initial_content) . '" 
               style="margin: 20px 0; min-height: 400px; border: 1px solid #ddd; border-radius: 4px;">
            <div style="padding: 20px; text-align: center; color: #666;">
                Loading VEDA Story Editor...
            </div>
          </div>';
    
    echo '<input type="hidden" id="veda_story_content_hidden" name="veda_story_content" value="' . esc_attr($saved_content) . '">';
    
    echo '<style>
        #postdivrich { display: none !important; }
        #post-status-info { display: none !important; }
    </style>';
});

add_action('save_post', function($post_id) {
    if (get_post_type($post_id) !== 'veda_story') return;
    if (!current_user_can('edit_post', $post_id)) return;
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
    if (wp_is_post_revision($post_id)) return;
    
    if (isset($_POST['veda_story_content'])) {
        $content = wp_unslash($_POST['veda_story_content']);
        update_post_meta($post_id, '_veda_story_content', $content);
    }
});

add_action('wp_ajax_veda_auto_save', 'veda_auto_save_story');
function veda_auto_save_story() {
    if (!wp_verify_nonce($_POST['nonce'], 'veda_editor_nonce')) {
        wp_send_json_error('Invalid nonce');
        return;
    }
    
    $post_id = intval($_POST['post_id']);
    $content = wp_unslash($_POST['content']);
    
    if (!current_user_can('edit_post', $post_id)) {
        wp_send_json_error('Unauthorized');
        return;
    }
    
    update_post_meta($post_id, '_veda_story_content', $content);
    update_post_meta($post_id, '_veda_story_autosave_time', time());
    
    wp_send_json_success([
        'message' => 'Auto-saved',
        'timestamp' => current_time('mysql')
    ]);
}

add_action('add_meta_boxes', function() {
    add_meta_box(
        'veda-story-info',
        'VEDA Story Info',
        'veda_story_info_callback',
        'veda_story',
        'side',
        'default'
    );
});

function veda_story_info_callback($post) {
    $content = get_post_meta($post->ID, '_veda_story_content', true);
    $autosave_time = get_post_meta($post->ID, '_veda_story_autosave_time', true);
    
    echo '<p><strong>Content Length:</strong> ' . strlen($content) . ' characters</p>';
    
    if ($autosave_time) {
        echo '<p><strong>Last Auto-save:</strong> ' . date('Y-m-d H:i:s', $autosave_time) . '</p>';
    }
    
    echo '<div id="veda-save-status" style="padding: 8px; background: #f0f0f1; border-radius: 4px; margin-top: 10px;">
            <span>✅ Ready to edit</span>
          </div>';
}

function convert_mdx_to_html($mdx_content) {
    $html = $mdx_content;
    
    // 1. Process fenced code blocks first, escaping their content
    $html = preg_replace_callback(
        '/```(\w*)\n?(.*?)```/s',
        function ($matches) {
            // Escape the code content to prevent it from being interpreted as HTML
            $code_content = htmlspecialchars(trim($matches[2]));
            return "<pre><code>" . $code_content . "</code></pre>";
        },
        $html
    );

    // 2. Process images
    $html = preg_replace('/!\[(.*?)\]\((.*?)\)/', '<img src="$2" alt="$1" style="max-width: 100%; height: auto; border-radius: 4px;">', $html);
    
    // 3. Process headings
    $html = preg_replace('/^###\s+(.*$)/m', '<h3>$1</h3>', $html);
    $html = preg_replace('/^##\s+(.*$)/m', '<h2>$1</h2>', $html);
    $html = preg_replace('/^#\s+(.*$)/m', '<h1>$1</h1>', $html);
    
    // 4. Process inline elements like bold, italic, and inline code
    $html = preg_replace('/\*\*(.*?)\*\*/s', '<strong>$1</strong>', $html);
    $html = preg_replace('/\*(.*?)\*/s', '<em>$1</em>', $html);
    $html = preg_replace('/`([^`]+)`/', '<code>$1</code>', $html);
    
    // 5. Convert newlines to <br> tags for paragraph breaks
    $html = nl2br(trim($html));
    
    // 6. Clean up extra <br> tags that nl2br might add after block elements
    $html = str_replace(["</pre><br />", "</h3><br />", "</h2><br />", "<h1><br />"], ["</pre>", "</h3>", "</h2>", "</h1>"], $html);

    return $html;
}

add_filter('the_content', function($content) {
    global $post;
    
    if (!$post || $post->post_type !== 'veda_story') {
        return $content;
    }
    
    $mdx_content = get_post_meta($post->ID, '_veda_story_content', true);
    
    if (!empty($mdx_content)) {
        $html_content = convert_mdx_to_html($mdx_content);
        return '<div class="veda-story-content">' . $html_content . '</div>';
    }
    
    return $content;
});