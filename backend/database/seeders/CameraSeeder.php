<?php

namespace Database\Seeders;

use App\Models\Camera;
use Illuminate\Database\Seeder;

class CameraSeeder extends Seeder
{
    public function run(): void
    {
        $cameras = [
            [
                'name' => 'Entrada Principal',
                'stream_url' => 'rtsp://demo:demo@ipvmdemo.dyndns.org:5541/onvif1',
                'is_active' => true,
                'position' => 1
            ],
            [
                'name' => 'Estacionamento',
                'stream_url' => 'rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mov',
                'is_active' => true,
                'position' => 2
            ],
            [
                'name' => 'Almoxarifado',
                'stream_url' => 'rtsp://192.168.1.50:554/cam/realmonitor?channel=1&subtype=0',
                'is_active' => true,
                'position' => 3
            ],
            [
                'name' => 'Laboratório',
                'stream_url' => 'rtsp://192.168.1.51:554/cam/realmonitor?channel=1&subtype=0',
                'is_active' => true,
                'position' => 4
            ],
        ];

        foreach ($cameras as $camera) {
            Camera::create($camera);
        }
    }
}
