<?php

namespace Tests\Feature;

use App\Models\Expense;
use App\Models\User;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ExpenseUploadTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware([
            \App\Http\Middleware\EnsureTenantScope::class,
            \App\Http\Middleware\CheckPermission::class,
        ]);

        $this->tenant = Tenant::factory()->create();
        $this->user = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
            'is_active' => true,
        ]);

        app()->instance('current_tenant_id', $this->tenant->id);
        \Laravel\Sanctum\Sanctum::actingAs($this->user, ['*']);
    }

    public function test_can_create_expense_with_receipt()
    {
        Storage::fake('public');

        $file = UploadedFile::fake()->image('receipt.jpg');

        $response = $this->postJson('/api/v1/expenses', [
            'description' => 'Test Expense with Receipt',
            'amount' => 100.00,
            'expense_date' => now()->toDateString(),
            'receipt' => $file,
        ]);

        $response->assertStatus(201);
        
        $expense = Expense::first();
        $this->assertNotNull($expense->receipt_path);
        
        // Assert file was stored
        // The path stored in DB is /storage/tenants/{id}/receipts/...
        // The actual path in storage disk is tenants/{id}/receipts/...
        $relativePath = str_replace('/storage/', '', $expense->receipt_path);
        Storage::disk('public')->assertExists($relativePath);
    }

    public function test_can_update_expense_replacing_receipt()
    {
        Storage::fake('public');

        // Create initial expense with receipt
        $oldFile = UploadedFile::fake()->image('old.jpg');
        $oldPath = $oldFile->store("tenants/{$this->tenant->id}/receipts", 'public');
        
        $expense = Expense::factory()->create([
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->user->id,
            'receipt_path' => "/storage/{$oldPath}",
        ]);

        Storage::disk('public')->assertExists($oldPath);

        // Update with new receipt
        $newFile = UploadedFile::fake()->image('new.jpg');
        
        $response = $this->putJson("/api/v1/expenses/{$expense->id}", [
            'description' => 'Updated Expense', // Changed description (sometimes rule)
            'receipt' => $newFile,
        ]);

        $response->assertStatus(200);

        $expense->refresh();
        $newRelativePath = str_replace('/storage/', '', $expense->receipt_path);

        Storage::disk('public')->assertExists($newRelativePath);
        Storage::disk('public')->assertMissing($oldPath); // Old file should be deleted
    }

    public function test_deleting_expense_deletes_receipt()
    {
        Storage::fake('public');

        $file = UploadedFile::fake()->image('receipt.jpg');
        $path = $file->store("tenants/{$this->tenant->id}/receipts", 'public');
        
        $expense = Expense::factory()->create([
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->user->id,
            'receipt_path' => "/storage/{$path}",
        ]);

        Storage::disk('public')->assertExists($path);

        $response = $this->deleteJson("/api/v1/expenses/{$expense->id}");
        $response->assertStatus(204);

        Storage::disk('public')->assertMissing($path);
    }
}
