<?php
/**
 * Plugin Name: VEDA Story Editor
 * Description: UI-only editor for VEDA Stories using MDX Editor.
 * Version: 3.0 (CSR)
 */

require_once plugin_dir_path(__FILE__) . 'post-type.php';

// This section remains unchanged. It handles loading the editor in the admin panel.
add_action('admin_enqueue_scripts', function ($hook) {
    global $post;
    if ('post.php' !== $hook && 'post-new.php' !== $hook) return;
    if (!isset($post) || $post->post_type !== 'veda_story') return;
    wp_enqueue_script( 'veda-editor', plugin_dir_url(__FILE__) . 'dist/admin-editor.build.js', ['wp-api-fetch'], filemtime(plugin_dir_path(__FILE__) . 'dist/admin-editor.build.js'), true );
    wp_localize_script('veda-editor', 'vedaEditor', [ 'postId' => $post->ID, 'restNonce' => wp_create_nonce('wp_rest'), 'ajaxNonce' => wp_create_nonce('veda_editor_nonce'), 'ajaxUrl' => admin_url('admin-ajax.php'), 'currentContent' => get_post_meta($post->ID, '_veda_story_content', true) ?: '' ]);
    if (file_exists(plugin_dir_path(__FILE__) . 'dist/admin-editor.build.css')) {
        wp_enqueue_style('veda-editor-style', plugin_dir_url(__FILE__) . 'dist/admin-editor.build.css', [], filemtime(plugin_dir_path(__FILE__) . 'dist/admin-editor.build.css') );
    }
});

// This section remains unchanged. It adds the editor container to the page.
add_action('edit_form_after_title', function ($post) { 
    if ($post->post_type !== 'veda_story') return;
    $saved_content = get_post_meta($post->ID, '_veda_story_content', true);
    $initial_content = $saved_content ?: '# ' . ($post->post_title ?: 'New VEDA Story') . '\n\nStart writing your story...';
    echo '<div id="veda-editor-root" data-post-id="' . esc_attr($post->ID) . '" data-initial="' . esc_attr($initial_content) . '" style="margin: 20px 0; min-height: 400px; border: 1px solid #ddd; border-radius: 4px;"><div style="padding: 20px; text-align: center; color: #666;">Loading VEDA Story Editor...</div></div>';
    echo '<input type="hidden" id="veda_story_content_hidden" name="veda_story_content" value="' . esc_attr($saved_content) . '">';
    echo '<style>#postdivrich { display: none !important; } #post-status-info { display: none !important; }</style>';
});

// This section remains unchanged. It handles saving the raw MDX content.
add_action('save_post', function($post_id) {
    if (get_post_type($post_id) !== 'veda_story') return;
    if (!current_user_can('edit_post', $post_id)) return;
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
    if (wp_is_post_revision($post_id)) return;
    if (isset($_POST['veda_story_content'])) {
        update_post_meta($post_id, '_veda_story_content', wp_unslash($_POST['veda_story_content']));
    }
});

// This section remains unchanged. It handles the ajax auto-save.
add_action('wp_ajax_veda_auto_save', 'veda_auto_save_story');
function veda_auto_save_story() {
    if (!wp_verify_nonce($_POST['nonce'], 'veda_editor_nonce')) { wp_send_json_error('Invalid nonce'); return; }
    $post_id = intval($_POST['post_id']);
    if (!current_user_can('edit_post', $post_id)) { wp_send_json_error('Unauthorized'); return; }
    update_post_meta($post_id, '_veda_story_content', wp_unslash($_POST['content']));
    update_post_meta($post_id, '_veda_story_autosave_time', time());
    wp_send_json_success(['message' => 'Auto-saved', 'timestamp' => current_time('mysql')]);
}

// This section remains unchanged. It handles the admin info meta box.
add_action('add_meta_boxes', function() {
    add_meta_box('veda-story-info', 'VEDA Story Info', 'veda_story_info_callback', 'veda_story', 'side', 'default');
});
function veda_story_info_callback($post) {
    $content = get_post_meta($post->ID, '_veda_story_content', true);
    $autosave_time = get_post_meta($post->ID, '_veda_story_autosave_time', true);
    echo '<p><strong>Content Length:</strong> ' . strlen($content) . ' characters</p>';
    if ($autosave_time) { echo '<p><strong>Last Auto-save:</strong> ' . date('Y-m-d H:i:s', $autosave_time) . '</p>'; }
    echo '<div id="veda-save-status" style="padding: 8px; background: #f0f0f1; border-radius: 4px; margin-top: 10px;"><span>✅ Ready to edit</span></div>';
}

// ### NEW ###
// This hook enqueues the script for the public-facing front end.
add_action('wp_enqueue_scripts', function() {
    // Only load our renderer script when viewing a single 'veda_story' post.
    if (is_singular('veda_story')) {
        global $post;

        // Path to our new renderer script, which we will create next.
        $renderer_script_path = plugin_dir_path(__FILE__) . 'dist/story-renderer.build.js';
        $renderer_script_url = plugin_dir_url(__FILE__) . 'dist/story-renderer.build.js';

        // Enqueue the script.
        wp_enqueue_script(
            'veda-story-renderer',
            $renderer_script_url,
            [], // No dependencies for now
            filemtime($renderer_script_path),
            true // Load in footer
        );

        // Get the raw MDX content and pass it to our script.
        $mdx_content = get_post_meta($post->ID, '_veda_story_content', true);
        wp_localize_script('veda-story-renderer', 'vedaStoryData', [
            'content' => $mdx_content ?? ''
        ]);
    }
});

// ### REWRITTEN ###
// This filter now just outputs a placeholder div for React to attach to.
add_filter('the_content', function($content) {
    global $post;
    
    if (!$post || !is_singular('veda_story')) {
        return $content;
    }

    // The entire content of the post will now be this single div.
    // Our JavaScript will find this div and render the story inside it.
    return '<div id="veda-story-root"><p style="text-align: center; padding: 40px;">Loading Story...</p></div>';
});

/**
 * Adds type="module" to the script tags for our custom scripts.
 * This allows us to use modern JavaScript modules.
 */
function add_type_attribute_to_veda_scripts($tag, $handle, $src) {
    // List of script handles to apply this to.
    $module_scripts = ['veda-editor', 'veda-story-renderer'];

    if (in_array($handle, $module_scripts)) {
        // Re-create the script tag with type="module"
        $tag = '<script type="module" src="' . esc_url($src) . '" id="' . $handle . '-js"></script>';
    }

    return $tag;
}
add_filter('script_loader_tag', 'add_type_attribute_to_veda_scripts', 10, 3);