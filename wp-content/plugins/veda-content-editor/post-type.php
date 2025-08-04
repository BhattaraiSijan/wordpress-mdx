<?php

add_action('init', function () {
    register_post_type('veda_story', [
        'labels' => [
            'name' => 'Veda Stories',
            'singular_name' => 'Veda Story',
        ],
        'public' => true,
        'show_in_menu' => true,
        'supports' => ['title'],
        'show_in_rest' => true,
    ]);
});

add_filter('use_block_editor_for_post_type', function ($use_block_editor, $post_type) {
    return $post_type === 'veda_story' ? false : $use_block_editor;
}, 10, 2);
