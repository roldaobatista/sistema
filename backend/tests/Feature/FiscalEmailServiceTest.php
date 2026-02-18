<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\FiscalNote;
use App\Models\Tenant;
use App\Services\Fiscal\FiscalEmailService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class FiscalEmailServiceTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private Customer $customer;
    private FiscalEmailService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenant = Tenant::factory()->create([
            'name' => 'Empresa Teste',
            'email' => 'empresa@teste.com',
            'phone' => '(65) 3333-3333',
        ]);

        $this->customer = Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
            'email' => 'cliente@email.com',
            'name' => 'João da Silva',
        ]);

        $this->service = new FiscalEmailService();

        Mail::fake();
        Storage::fake('local');
    }

    // ─── Validation ──────────────────────────────────

    public function test_send_fails_without_recipient_email(): void
    {
        $customerNoEmail = Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
            'email' => null,
        ]);

        $note = FiscalNote::factory()->nfe()->authorized()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $customerNoEmail->id,
        ]);

        $result = $this->service->send($note);

        $this->assertFalse($result['success']);
        $this->assertStringContainsString('e-mail', $result['message']);
    }

    public function test_send_fails_without_attachments(): void
    {
        $note = FiscalNote::factory()->nfe()->authorized()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'pdf_path' => null,
            'xml_path' => null,
            'pdf_url' => null,
            'xml_url' => null,
        ]);

        $result = $this->service->send($note);

        $this->assertFalse($result['success']);
        $this->assertStringContainsString('arquivo', $result['message']);
    }

    // ─── Successful Send ─────────────────────────────

    public function test_send_succeeds_with_pdf_attachment(): void
    {
        $pdfPath = 'fiscal/nfe/test_note.pdf';
        Storage::put($pdfPath, 'fake-pdf-content');

        $note = FiscalNote::factory()->nfe()->authorized()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'pdf_path' => $pdfPath,
            'xml_path' => null,
            'number' => '123',
        ]);

        $result = $this->service->send($note);

        $this->assertTrue($result['success']);
        $this->assertEquals('cliente@email.com', $result['recipient']);
    }

    public function test_send_uses_custom_recipient(): void
    {
        $pdfPath = 'fiscal/nfe/test_note.pdf';
        Storage::put($pdfPath, 'fake-pdf-content');

        $note = FiscalNote::factory()->nfe()->authorized()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'pdf_path' => $pdfPath,
            'number' => '456',
        ]);

        $result = $this->service->send($note, 'outro@email.com');

        $this->assertTrue($result['success']);
        $this->assertEquals('outro@email.com', $result['recipient']);
    }

    public function test_send_includes_both_pdf_and_xml(): void
    {
        $pdfPath = 'fiscal/nfe/note.pdf';
        $xmlPath = 'fiscal/nfe/note.xml';
        Storage::put($pdfPath, 'fake-pdf');
        Storage::put($xmlPath, '<xml>fake</xml>');

        $note = FiscalNote::factory()->nfe()->authorized()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'pdf_path' => $pdfPath,
            'xml_path' => $xmlPath,
            'number' => '789',
        ]);

        $result = $this->service->send($note);

        $this->assertTrue($result['success']);
    }

    // ─── NFS-e Specifics ─────────────────────────────

    public function test_send_nfse_works_correctly(): void
    {
        $pdfPath = 'fiscal/nfse/nfse_test.pdf';
        Storage::put($pdfPath, 'fake-nfse-pdf');

        $note = FiscalNote::factory()->nfse()->authorized()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'pdf_path' => $pdfPath,
            'number' => '100',
            'verification_code' => 'VCODE123',
        ]);

        $result = $this->service->send($note);

        $this->assertTrue($result['success']);
    }

    // ─── Error Handling ──────────────────────────────

    public function test_send_returns_failure_on_mail_exception(): void
    {
        Mail::shouldReceive('raw')
            ->once()
            ->andThrow(new \Exception('SMTP connection failed'));

        $pdfPath = 'fiscal/nfe/note.pdf';
        Storage::put($pdfPath, 'content');

        $note = FiscalNote::factory()->nfe()->authorized()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'pdf_path' => $pdfPath,
            'number' => '999',
        ]);

        $result = $this->service->send($note);

        $this->assertFalse($result['success']);
        $this->assertStringContainsString('SMTP', $result['message']);
    }
}
