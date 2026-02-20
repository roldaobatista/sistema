<?php

namespace Tests\Feature;

use App\Models\AccountPayable;
use App\Models\AccountReceivable;
use App\Models\BankStatement;
use App\Models\BankStatementEntry;
use App\Models\Customer;
use App\Models\Tenant;
use App\Models\User;
use App\Services\BankReconciliationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BankReconciliationCnabTest extends TestCase
{
    use RefreshDatabase;

    private BankReconciliationService $service;
    private Tenant $tenant;
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenant = Tenant::factory()->create();
        $this->user = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'current_tenant_id' => $this->tenant->id,
            'is_active' => true,
        ]);

        $this->service = new BankReconciliationService();
    }

    private function createTempFile(string $content, string $prefix = 'test_'): string
    {
        $tmpFile = tempnam(sys_get_temp_dir(), $prefix);
        file_put_contents($tmpFile, $content);
        return $tmpFile;
    }

    // ─── Format Detection ──────────────────────────────

    public function test_detect_format_ofx_by_extension(): void
    {
        $content = "<OFX><STMTTRN><TRNAMT>100.00\n<DTPOSTED>20260201\n<MEMO>Test</STMTTRN></OFX>";
        $tmpFile = $this->createTempFile($content);

        $statement = $this->service->import($this->tenant->id, $tmpFile, $this->user->id, 'extrato.ofx');
        $this->assertSame('ofx', $statement->format);

        @unlink($tmpFile);
    }

    public function test_detect_format_cnab240_by_line_length(): void
    {
        // First line exactly 240 chars = CNAB240
        $line = str_repeat('0', 240);
        $content = $line . "\n" . $line;
        $tmpFile = $this->createTempFile($content);

        $statement = $this->service->import($this->tenant->id, $tmpFile, $this->user->id, 'retorno.ret');
        $this->assertSame('cnab240', $statement->format);
        // No valid segments, so 0 entries
        $this->assertSame(0, $statement->total_entries);

        @unlink($tmpFile);
    }

    public function test_detect_format_cnab400_by_line_length(): void
    {
        // First line exactly 400 chars = CNAB400
        $line = str_repeat('0', 400);
        $content = $line . "\n" . $line;
        $tmpFile = $this->createTempFile($content);

        $statement = $this->service->import($this->tenant->id, $tmpFile, $this->user->id, 'retorno.rem');
        $this->assertSame('cnab400', $statement->format);

        @unlink($tmpFile);
    }

    // ─── OFX Parsing ───────────────────────────────────

    public function test_parse_ofx_extracts_entries(): void
    {
        $content = <<<OFX
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260201
<TRNAMT>1500.75
<MEMO>Pagamento cliente ABC
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260203
<TRNAMT>-320.00
<MEMO>Fornecedor XYZ
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
OFX;

        $tmpFile = $this->createTempFile($content);
        $statement = $this->service->import($this->tenant->id, $tmpFile, $this->user->id, 'extrato.ofx');

        $this->assertSame(2, $statement->total_entries);
        $entries = $statement->entries()->orderBy('id')->get();

        // Credit entry: positive amount
        $this->assertSame('credit', $entries[0]->type);
        $this->assertEquals(1500.75, (float) $entries[0]->amount);
        $this->assertStringContainsString('2026-02-01', $entries[0]->date);

        // Debit entry: negative amount becomes 'debit' with abs() stored
        $this->assertSame('debit', $entries[1]->type);
        $this->assertEquals(320.00, (float) $entries[1]->amount);
        $this->assertStringContainsString('2026-02-03', $entries[1]->date);

        @unlink($tmpFile);
    }

    // ─── Auto-Match ────────────────────────────────────

    public function test_auto_match_pairs_credit_with_receivable(): void
    {
        $customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);

        AccountReceivable::create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $customer->id,
            'created_by' => $this->user->id,
            'description' => 'Fatura mensal',
            'amount' => 500.00,
            'amount_paid' => 0,
            'due_date' => '2026-02-10',
            'status' => AccountReceivable::STATUS_PENDING,
        ]);

        $content = "<OFX><STMTTRN>\n<TRNAMT>500.00\n<DTPOSTED>20260210\n<MEMO>Deposito\n</STMTTRN></OFX>";
        $tmpFile = $this->createTempFile($content);

        $statement = $this->service->import($this->tenant->id, $tmpFile, $this->user->id, 'ext.ofx');

        $this->assertSame(1, $statement->matched_entries);
        $entry = $statement->entries()->first();
        $this->assertSame(BankStatementEntry::STATUS_MATCHED, $entry->status);
        $this->assertSame(AccountReceivable::class, $entry->matched_type);

        @unlink($tmpFile);
    }

    public function test_auto_match_pairs_debit_with_payable(): void
    {
        AccountPayable::create([
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->user->id,
            'description' => 'Conta energia',
            'amount' => 250.00,
            'amount_paid' => 0,
            'due_date' => '2026-02-15',
            'status' => AccountPayable::STATUS_PENDING,
        ]);

        $content = "<OFX><STMTTRN>\n<TRNAMT>-250.00\n<DTPOSTED>20260215\n<MEMO>Pagamento energia\n</STMTTRN></OFX>";
        $tmpFile = $this->createTempFile($content);

        $statement = $this->service->import($this->tenant->id, $tmpFile, $this->user->id, 'ext.ofx');

        $this->assertSame(1, $statement->matched_entries);
        $entry = $statement->entries()->first();
        $this->assertSame(BankStatementEntry::STATUS_MATCHED, $entry->status);
        $this->assertSame(AccountPayable::class, $entry->matched_type);

        @unlink($tmpFile);
    }

    public function test_auto_match_does_not_match_when_amount_differs(): void
    {
        $customer = Customer::factory()->create(['tenant_id' => $this->tenant->id]);

        AccountReceivable::create([
            'tenant_id' => $this->tenant->id,
            'customer_id' => $customer->id,
            'created_by' => $this->user->id,
            'description' => 'Fatura diferente',
            'amount' => 999.99,
            'amount_paid' => 0,
            'due_date' => '2026-02-10',
            'status' => AccountReceivable::STATUS_PENDING,
        ]);

        $content = "<OFX><STMTTRN>\n<TRNAMT>100.00\n<DTPOSTED>20260210\n<MEMO>Valor diferente\n</STMTTRN></OFX>";
        $tmpFile = $this->createTempFile($content);

        $statement = $this->service->import($this->tenant->id, $tmpFile, $this->user->id, 'ext.ofx');

        $this->assertSame(0, $statement->matched_entries);
        $entry = $statement->entries()->first();
        $this->assertSame(BankStatementEntry::STATUS_PENDING, $entry->status);

        @unlink($tmpFile);
    }

    // ─── Legacy Compat ─────────────────────────────────

    public function test_import_ofx_legacy_method_still_works(): void
    {
        $content = "<OFX><STMTTRN>\n<TRNAMT>50.00\n<DTPOSTED>20260101\n<MEMO>Legacy test\n</STMTTRN></OFX>";
        $tmpFile = $this->createTempFile($content);

        $statement = $this->service->importOfx($this->tenant->id, $tmpFile, $this->user->id, 'legacy.ofx');
        $this->assertInstanceOf(BankStatement::class, $statement);
        $this->assertSame(1, $statement->total_entries);

        @unlink($tmpFile);
    }
}
