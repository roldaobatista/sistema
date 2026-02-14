<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],
    'evolution' => [
        'url' => env('EVOLUTION_API_URL'),
        'api_key' => env('EVOLUTION_API_KEY'),
        'instance' => env('EVOLUTION_INSTANCE', 'default'),
    ],

    'fiscal' => [
        'provider' => env('FISCAL_PROVIDER', 'nuvemfiscal'),
    ],

    'nuvemfiscal' => [
        'url' => env('NUVEMFISCAL_URL', 'https://api.nuvemfiscal.com.br'),
        'client_id' => env('NUVEMFISCAL_CLIENT_ID'),
        'client_secret' => env('NUVEMFISCAL_CLIENT_SECRET'),
    ],

    'auvo' => [
        'api_key' => env('AUVO_API_KEY'),
        'api_token' => env('AUVO_API_TOKEN'),
    ],

    'webpush' => [
        'public_key' => env('VAPID_PUBLIC_KEY'),
        'private_key' => env('VAPID_PRIVATE_KEY'),
        'subject' => env('VAPID_SUBJECT', env('APP_URL', 'http://localhost')),
    ],

];
