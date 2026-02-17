<?php

namespace App\Services;

use App\Models\Product;
use Barryvdh\DomPDF\Facade\Pdf;
use Endroid\QrCode\Builder\Builder;
use Endroid\QrCode\Writer\PngWriter;
use Illuminate\Support\Collection;

class LabelGeneratorService
{
    public const QR_PREFIX = 'P';

    public static function qrPayload(Product $product): string
    {
        return self::QR_PREFIX . $product->id;
    }

    public function getFormats(): array
    {
        return config('label_formats.formats', []);
    }

    /** Max chars for name by label width (mm) to avoid overflow. */
    private const NAME_MAX_CHARS = [
        40 => 18,
        50 => 24,
        100 => 45,
        99 => 40,
    ];

    public function generateZpl(Product $product, string $formatKey): string
    {
        $formats = $this->getFormats();
        $format = $formats[$formatKey] ?? $formats['zebra_40x30'];
        $dpi = $format['dpi'] ?? 203;
        $wMm = $format['width_mm'];
        $hMm = $format['height_mm'];
        $wDots = (int) round($wMm * $dpi / 25.4);
        $hDots = (int) round($hMm * $dpi / 25.4);

        $maxNameChars = self::NAME_MAX_CHARS[(int) $wMm] ?? 25;
        $name = $this->escapeZpl(mb_substr($product->name, 0, $maxNameChars) . (mb_strlen($product->name) > $maxNameChars ? '…' : ''));
        $code = $this->escapeZpl($product->code ?? '');
        $mfr = $this->escapeZpl($product->manufacturer_code ?? '');
        $addr = $this->escapeZpl($product->storage_location ?? '');
        $payload = self::qrPayload($product);

        $x = 10;
        $y = 10;
        $fontH = $hMm <= 30 ? 12 : 15;
        $lineH = $hMm <= 30 ? 14 : 18;

        $zpl = "^XA\n";
        $zpl .= "^CF0,{$fontH}\n";
        $zpl .= "^FO{$x},{$y}^FD{$name}^FS\n";
        $y += $lineH;
        $zpl .= "^FO{$x},{$y}^FDCod: {$code}^FS\n";
        $y += $lineH;
        if ($mfr !== '') {
            $zpl .= "^FO{$x},{$y}^FDFab: {$mfr}^FS\n";
            $y += $lineH;
        }
        if ($addr !== '') {
            $zpl .= "^FO{$x},{$y}^FDLoc: {$addr}^FS\n";
            $y += $lineH;
        }

        $qrSize = min(80, $hDots - $y - 10, (int) round($wDots * 0.45));
        $qrX = $wDots - $qrSize - 10;
        $qrY = (int) round(($hDots - $qrSize) / 2);
        if ($qrY < $y) {
            $qrY = $y;
        }
        $zpl .= "^FO{$qrX},{$qrY}^BQN,2,4^FDQA," . $payload . "^FS\n";

        $zpl .= "^XZ\n";

        return $zpl;
    }

    public function generateZplMultiple(Collection $products, string $formatKey): string
    {
        $out = '';
        foreach ($products as $product) {
            $out .= $this->generateZpl($product, $formatKey);
        }
        return $out;
    }

    /**
     * @param  Collection<int, Product>  $products
     */
    public function generatePdf(Collection $products, string $formatKey, ?string $companyLogoPath = null): string
    {
        $formats = $this->getFormats();
        $format = $formats[$formatKey] ?? $formats['pdf_40x30'];
        $perPage = $format['per_page'] ?? 1;
        $widthMm = $format['width_mm'];
        $heightMm = $format['height_mm'];

        $labels = $products->map(function (Product $product) {
            $payload = self::qrPayload($product);
            $qrDataUri = $this->qrImageDataUri($payload);

            return [
                'product' => $product,
                'qr_payload' => $payload,
                'qr_image_src' => $qrDataUri,
            ];
        })->all();

        $pdf = Pdf::loadView('pdf.stock-label', [
            'labels' => $labels,
            'perPage' => $perPage,
            'widthMm' => $widthMm,
            'heightMm' => $heightMm,
            'company_logo_path' => $companyLogoPath,
        ]);

        if ($perPage > 1) {
            $pdf->setPaper('a4', 'portrait');
        } else {
            $pdf->setPaper([0, 0, $widthMm * 2.83465, $heightMm * 2.83465], 'portrait');
        }

        $path = storage_path('app/temp/stock-labels-' . uniqid() . '.pdf');
        if (!is_dir(dirname($path))) {
            mkdir(dirname($path), 0755, true);
        }
        $pdf->save($path);
        return $path;
    }

    private function escapeZpl(string $s): string
    {
        return str_replace(['^', '~', '\\', '_'], ['\^', '\~', '\\\\', '\_'], $s);
    }

    private function qrImageDataUri(string $payload): string
    {
        try {
            $builder = new Builder(
                writer: new PngWriter(),
                data: $payload,
                size: 120,
                margin: 4,
            );
            $result = $builder->build();
            $png = $result->getString();
            return 'data:' . $result->getMimeType() . ';base64,' . base64_encode($png);
        } catch (\Throwable) {
            return $this->qrImageDataUriFallback($payload);
        }
    }

    private function qrImageDataUriFallback(string $payload): string
    {
        $url = 'https://api.qrserver.com/v1/create-qr-code/?' . http_build_query([
            'size' => '120x120',
            'data' => $payload,
        ]);
        $bin = @file_get_contents($url);
        if ($bin === false || $bin === '') {
            return '';
        }
        return 'data:image/png;base64,' . base64_encode($bin);
    }
}
