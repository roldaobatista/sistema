<?php

namespace Tests\Feature;

use App\Models\BankAccount;
use App\Models\BankStatement;
use App\Models\BankStatementEntry;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ReconciliationExportTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected BankAccount $bankAccount;

    protected function setUp(): void
    {
        parent::setUp();
        
        $this->user = User::factory()->create();
        $this->actingAs($this->user);

        // Ensure user has tenant
        if (!$this->user->tenant_id) {
            $tenantId = \App\Models\Tenant::first()->id ?? \App\Models\Tenant::factory()->create()->id;
            $this->user->tenant_id = $tenantId;
            $this->user->save();
        }

        $this->bankAccount = BankAccount::factory()->create(['tenant_id' => $this->user->tenant_id]);
    }

    public function test_can_export_statement_pdf()
    {
        $this->withoutMiddleware([\App\Http\Middleware\CheckPermission::class]);

        $statement = BankStatement::factory()->create([
            'tenant_id' => $this->user->tenant_id,
            'bank_account_id' => $this->bankAccount->id,
            'filename' => 'Extrato Teste PDF'
        ]);

        BankStatementEntry::factory()->count(5)->create([
            'bank_statement_id' => $statement->id,
            'tenant_id' => $this->user->tenant_id,
            'date' => now()->subDays(rand(1, 10)),
            'amount' => rand(-500, 500)
        ]);

        $response = $this->getJson("/api/v1/bank-reconciliation/statements/{$statement->id}/export-pdf");

        // Assert download
        $response->assertStatus(200);
        $response->assertHeader('content-type', 'application/pdf');
        $response->assertHeader('content-disposition', "attachment; filename=conciliacao-Extrato Teste PDF.pdf");
    }

    public function test_export_pdf_fails_for_other_tenant()
    {
        // Create statement for another tenant
        $otherUser = User::factory()->create();
        $otherTenantId = $otherUser->tenant_id ?? \App\Models\Tenant::factory()->create()->id;
        
        $statement = BankStatement::factory()->create([
            'tenant_id' => $otherTenantId,
            'filename' => 'Extrato Outro Tenant'
        ]);

        $this->user->givePermissionTo('finance.receivable.view');

        $response = $this->getJson("/api/v1/bank-reconciliation/statements/{$statement->id}/export-pdf");

        $response->assertStatus(404);
    }
}
