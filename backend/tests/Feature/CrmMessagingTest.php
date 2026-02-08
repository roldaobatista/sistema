<?php

namespace Tests\Feature;

use App\Models\CrmActivity;
use App\Models\CrmMessage;
use App\Models\CrmMessageTemplate;
use App\Models\Customer;
use App\Models\Tenant;
use App\Models\User;
use App\Services\MessagingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CrmMessagingTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;
    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenant = Tenant::factory()->create();
        $this->user = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
            'is_active' => true,
        ]);

        app()->instance('current_tenant_id', $this->tenant->id);

        $this->customer = Customer::factory()->create([
            'tenant_id' => $this->tenant->id,
            'phone' => '11999887766',
            'email' => 'cliente@empresa.com',
        ]);

        Sanctum::actingAs($this->user, ['*']);
    }

    // ─── Message API ────────────────────────────────────

    public function test_list_messages(): void
    {
        CrmMessage::factory()->count(3)->whatsapp()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $response = $this->getJson('/api/v1/crm/messages');

        $response->assertOk()
            ->assertJsonPath('total', 3);
    }

    public function test_list_messages_filtered_by_channel(): void
    {
        CrmMessage::factory()->count(2)->whatsapp()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        CrmMessage::factory()->count(3)->email()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $this->getJson('/api/v1/crm/messages?channel=whatsapp')
            ->assertOk()
            ->assertJsonPath('total', 2);

        $this->getJson('/api/v1/crm/messages?channel=email')
            ->assertOk()
            ->assertJsonPath('total', 3);
    }

    public function test_send_whatsapp_without_evolution_config(): void
    {
        config(['services.evolution.url' => null]);

        $response = $this->postJson('/api/v1/crm/messages/send', [
            'customer_id' => $this->customer->id,
            'channel' => 'whatsapp',
            'body' => 'Olá, tudo bem?',
        ]);

        $response->assertCreated()
            ->assertJsonPath('channel', 'whatsapp')
            ->assertJsonPath('status', 'failed');

        $this->assertDatabaseHas('crm_messages', [
            'customer_id' => $this->customer->id,
            'channel' => 'whatsapp',
            'status' => 'failed',
        ]);
    }

    public function test_send_whatsapp_with_mock_evolution(): void
    {
        config([
            'services.evolution.url' => 'http://fake-evolution',
            'services.evolution.api_key' => 'test-key',
            'services.evolution.instance' => 'test',
        ]);

        Http::fake([
            'fake-evolution/*' => Http::response([
                'key' => ['id' => 'external-msg-123'],
                'status' => 'PENDING',
            ], 200),
        ]);

        $response = $this->postJson('/api/v1/crm/messages/send', [
            'customer_id' => $this->customer->id,
            'channel' => 'whatsapp',
            'body' => 'Olá, tudo bem?',
        ]);

        $response->assertCreated()
            ->assertJsonPath('channel', 'whatsapp')
            ->assertJsonPath('status', 'sent');

        $this->assertDatabaseHas('crm_messages', [
            'customer_id' => $this->customer->id,
            'external_id' => 'external-msg-123',
            'status' => 'sent',
        ]);

        // Should log to timeline
        $this->assertDatabaseHas('crm_activities', [
            'customer_id' => $this->customer->id,
            'type' => 'whatsapp',
            'is_automated' => true,
        ]);

        // Customer last_contact_at should update
        $this->customer->refresh();
        $this->assertTrue($this->customer->last_contact_at->isToday());
    }

    public function test_send_email(): void
    {
        Mail::fake();

        $response = $this->postJson('/api/v1/crm/messages/send', [
            'customer_id' => $this->customer->id,
            'channel' => 'email',
            'subject' => 'Proposta Comercial',
            'body' => '<p>Segue proposta em anexo.</p>',
        ]);

        $response->assertCreated()
            ->assertJsonPath('channel', 'email');

        $this->assertDatabaseHas('crm_messages', [
            'customer_id' => $this->customer->id,
            'channel' => 'email',
            'subject' => 'Proposta Comercial',
            'to_address' => 'cliente@empresa.com',
        ]);

        $this->assertDatabaseHas('crm_activities', [
            'customer_id' => $this->customer->id,
            'type' => 'email',
        ]);
    }

    public function test_send_requires_subject_for_email(): void
    {
        $this->postJson('/api/v1/crm/messages/send', [
            'customer_id' => $this->customer->id,
            'channel' => 'email',
            'body' => 'Corpo sem assunto',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('subject');
    }

    // ─── Templates ──────────────────────────────────────

    public function test_list_templates(): void
    {
        CrmMessageTemplate::factory()->count(2)->whatsapp()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        CrmMessageTemplate::factory()->email()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        $this->getJson('/api/v1/crm/message-templates')
            ->assertOk()
            ->assertJsonCount(3);

        $this->getJson('/api/v1/crm/message-templates?channel=whatsapp')
            ->assertOk()
            ->assertJsonCount(2);
    }

    public function test_create_template(): void
    {
        $response = $this->postJson('/api/v1/crm/message-templates', [
            'name' => 'Boas-vindas',
            'slug' => 'boas-vindas',
            'channel' => 'whatsapp',
            'body' => 'Olá {{nome}}, seja bem-vindo!',
            'variables' => [
                ['name' => 'nome', 'description' => 'Nome do cliente'],
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('name', 'Boas-vindas')
            ->assertJsonPath('slug', 'boas-vindas');

        $this->assertDatabaseHas('crm_message_templates', [
            'tenant_id' => $this->tenant->id,
            'slug' => 'boas-vindas',
        ]);
    }

    public function test_update_template(): void
    {
        $template = CrmMessageTemplate::factory()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Original',
        ]);

        $this->putJson("/api/v1/crm/message-templates/{$template->id}", [
            'name' => 'Atualizado',
            'body' => 'Novo corpo {{nome}}',
        ])->assertOk()
            ->assertJsonPath('name', 'Atualizado');
    }

    public function test_delete_template(): void
    {
        $template = CrmMessageTemplate::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);

        $this->deleteJson("/api/v1/crm/message-templates/{$template->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('crm_message_templates', ['id' => $template->id]);
    }

    public function test_send_from_template(): void
    {
        config([
            'services.evolution.url' => 'http://fake-evolution',
            'services.evolution.api_key' => 'test-key',
            'services.evolution.instance' => 'test',
        ]);

        Http::fake([
            'fake-evolution/*' => Http::response([
                'key' => ['id' => 'tmpl-msg-456'],
            ], 200),
        ]);

        $template = CrmMessageTemplate::factory()->create([
            'tenant_id' => $this->tenant->id,
            'channel' => 'whatsapp',
            'body' => 'Olá {{nome}}, seu equipamento está pronto!',
        ]);

        $response = $this->postJson('/api/v1/crm/messages/send', [
            'customer_id' => $this->customer->id,
            'channel' => 'whatsapp',
            'body' => 'ignored when template is used',
            'template_id' => $template->id,
        ]);

        $response->assertCreated()
            ->assertJsonPath('status', 'sent');

        $msg = CrmMessage::first();
        $this->assertStringContains('Olá ' . $this->customer->name, $msg->body);
    }

    // ─── Webhooks ────────────────────────────────────────

    public function test_whatsapp_webhook_status_update(): void
    {
        $message = CrmMessage::factory()->whatsapp()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'external_id' => 'wamid-12345',
            'status' => 'sent',
        ]);

        $response = $this->postJson('/api/webhooks/whatsapp', [
            'event' => 'messages.update',
            'data' => [
                [
                    'key' => ['id' => 'wamid-12345'],
                    'update' => ['status' => 'DELIVERY_ACK'],
                ],
            ],
        ]);

        $response->assertOk();

        $message->refresh();
        $this->assertEquals('delivered', $message->status);
        $this->assertNotNull($message->delivered_at);
    }

    public function test_whatsapp_webhook_read_status(): void
    {
        $message = CrmMessage::factory()->whatsapp()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'external_id' => 'wamid-67890',
            'status' => 'delivered',
        ]);

        $this->postJson('/api/webhooks/whatsapp', [
            'event' => 'messages.update',
            'data' => [
                [
                    'key' => ['id' => 'wamid-67890'],
                    'update' => ['status' => 'READ'],
                ],
            ],
        ])->assertOk();

        $message->refresh();
        $this->assertEquals('read', $message->status);
        $this->assertNotNull($message->read_at);
    }

    public function test_whatsapp_webhook_inbound_message(): void
    {
        $this->postJson('/api/webhooks/whatsapp', [
            'event' => 'messages.upsert',
            'data' => [
                [
                    'key' => [
                        'remoteJid' => '5511999887766@s.whatsapp.net',
                        'fromMe' => false,
                        'id' => 'inbound-id-001',
                    ],
                    'message' => [
                        'conversation' => 'Preciso fazer calibração da balança',
                    ],
                ],
            ],
        ])->assertOk();

        $this->assertDatabaseHas('crm_messages', [
            'customer_id' => $this->customer->id,
            'channel' => 'whatsapp',
            'direction' => 'inbound',
            'external_id' => 'inbound-id-001',
        ]);

        // Should log to timeline
        $this->assertDatabaseHas('crm_activities', [
            'customer_id' => $this->customer->id,
            'type' => 'whatsapp',
        ]);
    }

    public function test_email_webhook_delivery(): void
    {
        $message = CrmMessage::factory()->email()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'external_id' => 'email-msg-id-001',
            'status' => 'sent',
        ]);

        $this->postJson('/api/webhooks/email', [
            ['type' => 'delivered', 'message_id' => 'email-msg-id-001'],
        ])->assertOk();

        $message->refresh();
        $this->assertEquals('delivered', $message->status);
    }

    public function test_email_webhook_bounce(): void
    {
        $message = CrmMessage::factory()->email()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'external_id' => 'email-msg-id-002',
            'status' => 'sent',
        ]);

        $this->postJson('/api/webhooks/email', [
            ['type' => 'bounced', 'message_id' => 'email-msg-id-002', 'reason' => 'Mailbox full'],
        ])->assertOk();

        $message->refresh();
        $this->assertEquals('failed', $message->status);
        $this->assertEquals('Mailbox full', $message->error_message);
    }

    // ─── Model Methods ──────────────────────────────────

    public function test_message_status_transitions(): void
    {
        $message = CrmMessage::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'status' => 'pending',
        ]);

        $message->markSent('ext-123');
        $this->assertEquals('sent', $message->fresh()->status);
        $this->assertEquals('ext-123', $message->fresh()->external_id);

        $message->markDelivered();
        $this->assertEquals('delivered', $message->fresh()->status);

        $message->markRead();
        $this->assertEquals('read', $message->fresh()->status);
    }

    public function test_message_mark_failed(): void
    {
        $message = CrmMessage::factory()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
            'status' => 'pending',
        ]);

        $message->markFailed('Timeout');

        $msg = $message->fresh();
        $this->assertEquals('failed', $msg->status);
        $this->assertEquals('Timeout', $msg->error_message);
        $this->assertNotNull($msg->failed_at);
    }

    public function test_message_log_to_timeline(): void
    {
        $message = CrmMessage::factory()->whatsapp()->create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $this->customer->id,
        ]);

        $activity = $message->logToTimeline();

        $this->assertDatabaseHas('crm_activities', [
            'id' => $activity->id,
            'customer_id' => $this->customer->id,
            'type' => 'whatsapp',
            'is_automated' => true,
        ]);
    }

    public function test_template_render(): void
    {
        $template = CrmMessageTemplate::factory()->create([
            'tenant_id' => $this->tenant->id,
            'body' => 'Olá {{nome}}, seu valor é R$ {{valor}}.',
            'subject' => 'Proposta para {{nome}}',
        ]);

        $rendered = $template->render([
            'nome' => 'Acme Corp',
            'valor' => '1.500,00',
        ]);

        $this->assertEquals('Olá Acme Corp, seu valor é R$ 1.500,00.', $rendered);

        $renderedSubject = $template->renderSubject(['nome' => 'Acme Corp']);
        $this->assertEquals('Proposta para Acme Corp', $renderedSubject);
    }

    // ─── Helper ─────────────────────────────────────────

    private function assertStringContains(string $needle, string $haystack): void
    {
        $this->assertTrue(
            str_contains($haystack, $needle),
            "Failed asserting that '{$haystack}' contains '{$needle}'"
        );
    }
}
