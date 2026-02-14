<?php

namespace App\Services\Fiscal;

/**
 * Result object returned by all fiscal provider operations.
 */
class FiscalResult
{
    public function __construct(
        public readonly bool $success,
        public readonly ?string $providerId = null,
        public readonly ?string $accessKey = null,
        public readonly ?string $number = null,
        public readonly ?string $series = null,
        public readonly ?string $status = null,
        public readonly ?string $pdfUrl = null,
        public readonly ?string $xmlUrl = null,
        public readonly ?string $errorMessage = null,
        public readonly ?array $rawResponse = null,
    ) {}

    public static function ok(array $data = []): self
    {
        return new self(
            success: true,
            providerId: $data['provider_id'] ?? null,
            accessKey: $data['access_key'] ?? null,
            number: $data['number'] ?? null,
            series: $data['series'] ?? null,
            status: $data['status'] ?? 'authorized',
            pdfUrl: $data['pdf_url'] ?? null,
            xmlUrl: $data['xml_url'] ?? null,
            rawResponse: $data['raw'] ?? null,
        );
    }

    public static function fail(string $message, ?array $raw = null): self
    {
        return new self(
            success: false,
            errorMessage: $message,
            rawResponse: $raw,
        );
    }
}
