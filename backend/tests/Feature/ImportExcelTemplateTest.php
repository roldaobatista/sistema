<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\ImportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ImportExcelTemplateTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Ensure we have a tenant context
        $this->user = User::factory()->create([
            'tenant_id' => 1
        ]);
        $this->actingAs($this->user);
    }

    /** @test */
    public function it_can_generate_excel_content_for_customers()
    {
        $service = new ImportService();
        $content = $service->generateSampleExcel('customers');

        $this->assertNotEmpty($content);
        // Excel files start with 'PK' (Zip archive)
        $this->assertStringStartsWith('PK', $content);
    }

    /** @test */
    public function endpoint_returns_excel_file_with_correct_headers()
    {
        $response = $this->getJson('/api/import/sample/customers');

        $response->assertStatus(200);
        
        $response->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        $response->assertHeader('content-disposition', 'attachment; filename=modelo_importacao_customers.xlsx');
        
        $content = $response->streamedContent();
        $this->assertStringStartsWith('PK', $content);
    }
}
