<?php

return [
    'formats' => [
        'zebra_40x30' => [
            'name' => 'Etiqueta térmica 40x30 mm (Zebra)',
            'width_mm' => 40,
            'height_mm' => 30,
            'output' => 'zpl',
            'dpi' => 203,
        ],
        'zebra_50x30' => [
            'name' => 'Etiqueta térmica 50x30 mm (Zebra)',
            'width_mm' => 50,
            'height_mm' => 30,
            'output' => 'zpl',
            'dpi' => 203,
        ],
        'zebra_100x50' => [
            'name' => 'Etiqueta térmica 100x50 mm (Zebra)',
            'width_mm' => 100,
            'height_mm' => 50,
            'output' => 'zpl',
            'dpi' => 203,
        ],
        'pdf_40x30' => [
            'name' => 'PDF 40x30 mm (impressora comum)',
            'width_mm' => 40,
            'height_mm' => 30,
            'output' => 'pdf',
        ],
        'pdf_50x30' => [
            'name' => 'PDF 50x30 mm (impressora comum)',
            'width_mm' => 50,
            'height_mm' => 30,
            'output' => 'pdf',
        ],
        'pdf_a4_8' => [
            'name' => 'PDF A4 (8 etiquetas por folha)',
            'width_mm' => 99,
            'height_mm' => 38,
            'output' => 'pdf',
            'per_page' => 8,
        ],
    ],
];
