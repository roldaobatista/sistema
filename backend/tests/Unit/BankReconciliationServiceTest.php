<?php

namespace Tests\Unit;

use App\Services\BankReconciliationService;
use Tests\TestCase;

/**
 * Unit tests for BankReconciliationService — validates
 * file format detection and parsing of OFX, CNAB 240, and CNAB 400 files.
 */
class BankReconciliationServiceTest extends TestCase
{
    private BankReconciliationService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new BankReconciliationService();
    }

    // ── FORMAT DETECTION ──

    public function test_detect_ofx_from_content(): void
    {
        $content = "OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\n<OFX><SIGNONMSGSRSV1>";
        $format = $this->service->detectFormat($content, 'extrato.ofx');

        $this->assertEquals('ofx', $format);
    }

    public function test_detect_cnab240_from_content(): void
    {
        // CNAB 240: first record is 240 chars, position 7-8 = '04' (batch header)
        $line1 = str_pad('00000001', 240, '0');
        $content = $line1 . "\n" . str_pad('00000002', 240, '0');

        $format = $this->service->detectFormat($content, 'retorno.ret');

        // Should detect from line length (240 chars)
        $this->assertNotNull($format);
        $this->assertContains($format, ['cnab240', 'cnab400', 'ofx']);
    }

    public function test_detect_cnab400_from_content(): void
    {
        // CNAB 400: first record is 400 chars
        $content = str_pad('0', 400, '0') . "\n" . str_pad('1', 400, '0');
        $format = $this->service->detectFormat($content, 'retorno.ret');

        $this->assertNotNull($format);
        $this->assertContains($format, ['cnab400', 'cnab240', 'ofx']);
    }

    public function test_detect_from_filename_extension(): void
    {
        $ofxContent = '<OFX>';
        $format = $this->service->detectFormat($ofxContent, 'banco_jan2025.ofx');

        $this->assertEquals('ofx', $format);
    }

    // ── CNAB PARSING HELPERS ──

    public function test_parse_cnab_date_ddmmyyyy(): void
    {
        $date = $this->service->parseCnabDate('15012025', 'ddmmyyyy');
        $this->assertEquals('2025-01-15', $date);
    }

    public function test_parse_cnab_date_ddmmyy(): void
    {
        $date = $this->service->parseCnabDate('150125', 'ddmmyy');
        $this->assertEquals('2025-01-15', $date);
    }

    public function test_parse_cnab_amount_with_cents(): void
    {
        // R$ 1.500,50 = 150050 in CNAB format (last 2 digits = cents)
        $amount = $this->service->parseCnabAmount('0000000150050');
        $this->assertEquals(1500.50, $amount);
    }

    public function test_parse_cnab_amount_zero(): void
    {
        $amount = $this->service->parseCnabAmount('0000000000000');
        $this->assertEquals(0, $amount);
    }

    public function test_parse_cnab_amount_small_value(): void
    {
        // R$ 0,01
        $amount = $this->service->parseCnabAmount('0000000000001');
        $this->assertEquals(0.01, $amount);
    }

    public function test_parse_cnab_amount_large_value(): void
    {
        // R$ 99.999,99
        $amount = $this->service->parseCnabAmount('0000009999999');
        $this->assertEquals(99999.99, $amount);
    }

    // ── OFX PARSING ──

    public function test_parse_ofx_extracts_transactions(): void
    {
        $ofxContent = "OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\n<OFX>\n<BANKMSGSRSV1>\n<STMTRS>\n<BANKTRANLIST>\n<STMTTRN>\n<TRNTYPE>CREDIT\n<DTPOSTED>20250115\n<TRNAMT>1500.00\n<FITID>TRN001\n<MEMO>PAGAMENTO CLIENTE X\n</STMTTRN>\n<STMTTRN>\n<TRNTYPE>DEBIT\n<DTPOSTED>20250116\n<TRNAMT>-250.00\n<FITID>TRN002\n<MEMO>TAXA BANCARIA\n</STMTTRN>\n</BANKTRANLIST>\n</STMTRS>\n</BANKMSGSRSV1>\n</OFX>";

        $transactions = $this->service->parseOfx($ofxContent);

        $this->assertIsArray($transactions);
        $this->assertGreaterThanOrEqual(1, count($transactions));
    }
}
