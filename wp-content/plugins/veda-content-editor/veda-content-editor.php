<?php
/**
 * Plugin Name: VEDA Story Editor
 * Description: UI-only editor for VEDA Stories using MDX Editor.
 * Version: 3.0 (CSR)
 */

require_once plugin_dir_path(__FILE__) . 'post-type.php';

// Register story content meta so it is available via the REST API
add_action('init', function() {
    register_post_meta('veda_story', '_veda_story_content', [
        'show_in_rest' => [
            'name' => 'veda_story_content',
            'schema' => [
                'type' => 'string',
            ],
        ],
        'single' => true,
        'type' => 'string',
        'auth_callback' => '__return_true',
    ]);
});

add_action('admin_enqueue_scripts', function ($hook) {
    global $post;
    if ('post.php' !== $hook && 'post-new.php' !== $hook) return;
    if (!isset($post) || $post->post_type !== 'veda_story') return;

    wp_enqueue_script('react');
    wp_enqueue_script('react-dom');

    wp_enqueue_style(
        'mdx-editor-style',
        'https://unpkg.com/@mdxeditor/editor@latest/style.css',
        [],
        '1.0.0'
    );

    $script_path = plugin_dir_path(__FILE__) . 'dist/story-editor.build.js';
    $script_url  = plugin_dir_url(__FILE__) . 'dist/story-editor.build.js';

    if (file_exists($script_path)) {
        wp_enqueue_script(
            'veda-editor',
            $script_url,
            ['jquery', 'react', 'react-dom'],
            filemtime($script_path),
            true
        );

        wp_localize_script('veda-editor', 'vedaEditor', [
            'postId' => $post->ID,
            'restNonce' => wp_create_nonce('wp_rest'),
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'saveEndpoint' => admin_url('admin-ajax.php?action=veda_save_story'),
            'currentContent' => get_post_meta($post->ID, '_veda_story_content', true) ?: ''
        ]);
    }
    
    if (file_exists(plugin_dir_path(__FILE__) . 'dist/story-editor.build.css')) {
        wp_enqueue_style(
            'veda-editor-style',
            plugin_dir_url(__FILE__) . 'dist/story-editor.build.css',
            [],
            filemtime(plugin_dir_path(__FILE__) . 'dist/story-editor.build.css')
        );
    }
});

add_action('edit_form_after_title', function ($post) { 
    if ($post->post_type !== 'veda_story') return;
    $saved_content = get_post_meta($post->ID, '_veda_story_content', true);
    $initial_content = $saved_content ?: '# ' . ($post->post_title ?: 'New VEDA Story') . '\n\nStart writing your story...';
    echo '<div id="veda-editor-root" data-post-id="' . esc_attr($post->ID) . '" data-initial="' . esc_attr($initial_content) . '" style="margin: 20px 0; min-height: 400px; border: 1px solid #ddd; border-radius: 4px;"><div style="padding: 20px; text-align: center; color: #666;">Loading VEDA Story Editor...</div></div>';
    echo '<input type="hidden" id="veda_story_content_hidden" name="veda_story_content" value="' . esc_attr($saved_content) . '">';
    echo '<style>#postdivrich { display: none !important; } #post-status-info { display: none !important; }</style>';
});

add_action('save_post', function($post_id) {
    if (get_post_type($post_id) !== 'veda_story') return;
    if (!current_user_can('edit_post', $post_id)) return;
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
    if (wp_is_post_revision($post_id)) return;
    if (isset($_POST['veda_story_content'])) {
        update_post_meta($post_id, '_veda_story_content', wp_unslash($_POST['veda_story_content']));
    }
});

add_action('wp_ajax_veda_save_story', 'veda_manual_save_story');
function veda_manual_save_story() {
    $data = json_decode(file_get_contents('php://input'), true);

    if (json_last_error() !== JSON_ERROR_NONE || !isset($data['post_id']) || !isset($data['content'])) {
        wp_send_json_error('Invalid request format.');
        return;
    }

    $nonce = isset($_SERVER['HTTP_X_WP_NONCE']) ? $_SERVER['HTTP_X_WP_NONCE'] : '';
    if (!wp_verify_nonce($nonce, 'wp_rest')) {
        wp_send_json_error('Invalid nonce.');
        return;
    }
    
    $post_id = intval($data['post_id']);
    if (!current_user_can('edit_post', $post_id)) { 
        wp_send_json_error('Unauthorized.'); 
        return; 
    }
    
    update_post_meta($post_id, '_veda_story_content', wp_unslash($data['content']));
    update_post_meta($post_id, '_veda_story_autosave_time', time());
    
    wp_send_json_success(['message' => 'Saved', 'timestamp' => current_time('mysql')]);
}

add_action('add_meta_boxes', function() {
    add_meta_box('veda-story-info', 'VEDA Story Info', 'veda_story_info_callback', 'veda_story', 'side', 'default');
});

function veda_story_info_callback($post) {
    $content = get_post_meta($post->ID, '_veda_story_content', true);
    $autosave_time = get_post_meta($post->ID, '_veda_story_autosave_time', true);
    echo '<p><strong>Content Length:</strong> ' . strlen($content) . ' characters</p>';
    if ($autosave_time) { echo '<p><strong>Last Manual Save:</strong> ' . date('Y-m-d H:i:s', $autosave_time) . '</p>'; }
    echo '<div id="veda-save-status" style="padding: 8px; background: #f0f0f1; border-radius: 4px; margin-top: 10px;"><span>✅ Ready to edit</span></div>';
}

add_action('wp_enqueue_scripts', function() {
    if (is_singular('veda_story')) {
        global $post;

        wp_enqueue_script('react');
        wp_enqueue_script('react-dom');

        $renderer_script_path = plugin_dir_path(__FILE__) . 'dist/story-renderer.build.js';
        $renderer_script_url = plugin_dir_url(__FILE__) . 'dist/story-renderer.build.js';

        if (file_exists($renderer_script_path)) {
            wp_enqueue_script(
                'veda-story-renderer',
                $renderer_script_url,
                ['react', 'react-dom'],
                filemtime($renderer_script_path),
                true
            );

            $mdx_content = get_post_meta($post->ID, '_veda_story_content', true);
            wp_localize_script('veda-story-renderer', 'vedaStoryData', [
                'content' => $mdx_content ?? '',
                'postId' => $post->ID,
                'ajaxUrl' => admin_url('admin-ajax.php'),
                'restNonce' => wp_create_nonce('wp_rest'),
            ]);
        }
    }
});

add_filter('the_content', function($content) {
    global $post;
    if (!$post || !is_singular('veda_story')) return $content;
    return '<div id="veda-story-root"><p style="text-align: center; padding: 40px;">Loading Story...</p></div>';
});

add_action('wp_ajax_nopriv_get_veda_story_content', 'veda_get_story_content_callback');
add_action('wp_ajax_get_veda_story_content', 'veda_get_story_content_callback');
function veda_get_story_content_callback() {
    if (!isset($_POST['post_id'])) {
        wp_send_json_error('Missing post_id.');
        return;
    }

    $post_id = intval($_POST['post_id']);
    $content = get_post_meta($post_id, '_veda_story_content', true);

    if ($content) {
        wp_send_json_success($content);
    } else {
        wp_send_json_error('Content not found.');
    }
}