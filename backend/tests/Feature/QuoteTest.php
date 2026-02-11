<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Equipment;
use App\Models\Product;
use App\Models\Quote;
use App\Models\SystemSetting;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class QuoteTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;
    private Customer $customer;

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
        $this->customer = Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        app()->instance('current_tenant_id', $this->tenant->id);
        Sanctum::actingAs($this->user, ['*']);
        \Illuminate\Support\Facades\Event::fake();
    }

    public function test_create_quote(): void
    {
        $product = Product::factory()->create(['tenant_id' => $this->tenant->id]);
        $equipment = Equipment::factory()->create(['tenant_id' => $this->tenant->id, 'customer_id' => $this->customer->id]);

        $payload = [
            'customer_id' => $this->customer->id,
            'valid_until' => now()->addDays(7)->format('Y-m-d'),
            'discount_percentage' => 0,
            'equipments' => [
                [
                    'equipment_id' => $equipment->id,
                    'description' => 'Manutencao preventiva',
                    'items' => [
                        [
                            'type' => 'product',
                            'product_id' => $product->id,
                            'quantity' => 1,
                            'original_price' => 100,
                            'unit_price' => 100,
                        ]
                    ]
                ]
            ]
        ];

        $response = $this->postJson('/api/v1/quotes', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('status', Quote::STATUS_DRAFT);
    }

    public function test_list_quotes(): void
    {
        Quote::factory()->count(3)->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $response = $this->getJson('/api/v1/quotes');

        $response->assertOk()
            ->assertJsonPath('total', 3);
    }

    public function test_show_quote(): void
    {
        $quote = Quote::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $response = $this->getJson("/api/v1/quotes/{$quote->id}");

        $response->assertOk()
            ->assertJsonPath('id', $quote->id);
    }

    public function test_approve_quote(): void
    {
        $quote = Quote::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'status' => Quote::STATUS_SENT,
        ]);

        $response = $this->postJson("/api/v1/quotes/{$quote->id}/approve");

        $response->assertOk()
            ->assertJsonPath('status', Quote::STATUS_APPROVED);
    }

    public function test_tenant_isolation(): void
    {
        $otherTenant = Tenant::factory()->create();
        
        Quote::factory()->create([
            'tenant_id' => $otherTenant->id,
            'customer_id' => Customer::factory()->create(['tenant_id' => $otherTenant->id])->id,
            'quote_number' => 'EXT-001',
        ]);

        Quote::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'quote_number' => 'INT-001',
        ]);

        $response = $this->getJson('/api/v1/quotes');

        $response->assertOk()
            ->assertSee('INT-001')
            ->assertDontSee('EXT-001');
    }

    public function test_quote_sequence_start_setting_is_respected_without_breaking_existing_sequence(): void
    {
        SystemSetting::setValue('quote_sequence_start', '1500', 'integer', 'quotes');

        $this->assertSame('ORC-01500', Quote::nextNumber($this->tenant->id));

        Quote::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'quote_number' => 'ORC-01620',
        ]);

        $this->assertSame('ORC-01621', Quote::nextNumber($this->tenant->id));

        SystemSetting::setValue('quote_sequence_start', '2000', 'integer', 'quotes');

        $this->assertSame('ORC-02000', Quote::nextNumber($this->tenant->id));
    }

    public function test_quote_sequence_uses_highest_historical_value_even_if_latest_record_is_external(): void
    {
        Quote::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'quote_number' => 'ORC-03000',
        ]);

        Quote::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'quote_number' => 'EXT-00001',
        ]);

        $this->assertSame('ORC-03001', Quote::nextNumber($this->tenant->id));
    }

    public function test_create_quote_uses_sequence_start_from_settings_endpoint(): void
    {
        $this->putJson('/api/v1/settings', [
            'settings' => [
                [
                    'key' => 'quote_sequence_start',
                    'value' => '3500',
                    'type' => 'integer',
                    'group' => 'quotes',
                ],
            ],
        ])->assertOk();

        $equipment = \App\Models\Equipment::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $product = \App\Models\Product::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        $payload = [
            'customer_id' => $this->customer->id,
            'seller_id' => $this->user->id,
            'equipments' => [
                [
                    'equipment_id' => $equipment->id,
                    'description' => 'Orcamento teste',
                    'items' => [
                        [
                            'type' => 'product',
                            'product_id' => $product->id,
                            'quantity' => 1,
                            'original_price' => 100,
                            'unit_price' => 100,
                            'discount_percentage' => 0,
                        ],
                    ],
                ],
            ],
        ];

        $first = $this->postJson('/api/v1/quotes', $payload);
        $first->assertStatus(201)
            ->assertJsonPath('quote_number', 'ORC-03500');

        $second = $this->postJson('/api/v1/quotes', $payload);
        $second->assertStatus(201)
            ->assertJsonPath('quote_number', 'ORC-03501');
    }

    public function test_rejects_invalid_quote_sequence_start_setting(): void
    {
        $response = $this->putJson('/api/v1/settings', [
            'settings' => [
                [
                    'key' => 'quote_sequence_start',
                    'value' => '0',
                    'type' => 'integer',
                    'group' => 'quotes',
                ],
            ],
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['settings']);
    }

    public function test_cannot_mutate_sent_quote_through_item_and_equipment_endpoints(): void
    {
        $equipment = Equipment::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $product = Product::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        $quote = Quote::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'seller_id' => $this->user->id,
            'status' => Quote::STATUS_SENT,
        ]);

        $quoteEquipment = $quote->equipments()->create([
            'tenant_id' => $this->tenant->id,
            'equipment_id' => $equipment->id,
            'description' => 'Equipamento bloqueado para edicao',
            'sort_order' => 0,
        ]);

        $item = $quoteEquipment->items()->create([
            'tenant_id' => $this->tenant->id,
            'type' => 'product',
            'product_id' => $product->id,
            'quantity' => 1,
            'original_price' => 100,
            'unit_price' => 100,
            'discount_percentage' => 0,
            'sort_order' => 0,
        ]);

        $this->postJson("/api/v1/quotes/{$quote->id}/equipments", [
            'equipment_id' => $equipment->id,
        ])->assertStatus(422);

        $this->postJson("/api/v1/quote-equipments/{$quoteEquipment->id}/items", [
            'type' => 'product',
            'product_id' => $product->id,
            'quantity' => 1,
            'original_price' => 50,
            'unit_price' => 50,
        ])->assertStatus(422);

        $this->deleteJson("/api/v1/quote-items/{$item->id}")
            ->assertStatus(422);

        $this->deleteJson("/api/v1/quotes/{$quote->id}/equipments/{$quoteEquipment->id}")
            ->assertStatus(422);
    }

    public function test_convert_to_os_conflict_returns_business_number(): void
    {
        $quote = Quote::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'seller_id' => $this->user->id,
            'status' => Quote::STATUS_APPROVED,
        ]);

        WorkOrder::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'quote_id' => $quote->id,
            'os_number' => 'BL-OS-7711',
            'number' => 'OS-000771',
            'created_by' => $this->user->id,
        ]);

        $response = $this->postJson("/api/v1/quotes/{$quote->id}/convert-to-os");

        $response->assertStatus(409)
            ->assertJsonPath('work_order.os_number', 'BL-OS-7711')
            ->assertJsonPath('work_order.business_number', 'BL-OS-7711');
    }
    public function test_reject_quote_with_reason(): void
    {
        $quote = Quote::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'seller_id' => $this->user->id,
            'status' => Quote::STATUS_SENT,
        ]);

        $response = $this->postJson("/api/v1/quotes/{$quote->id}/reject", [
            'reason' => 'Preço muito alto',
        ]);

        $response->assertOk()
            ->assertJsonPath('status', Quote::STATUS_REJECTED)
            ->assertJsonPath('rejection_reason', 'Preço muito alto');

        $this->assertDatabaseHas('quotes', [
            'id' => $quote->id,
            'status' => Quote::STATUS_REJECTED,
            'rejection_reason' => 'Preço muito alto',
        ]);
    }

    public function test_cannot_reject_draft_quote(): void
    {
        $quote = Quote::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'status' => Quote::STATUS_DRAFT,
        ]);

        $this->postJson("/api/v1/quotes/{$quote->id}/reject")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Orçamento precisa estar enviado para rejeitar');
    }
}
