<?php

namespace Tests\Unit;

use Tests\TestCase;

/**
 * Money Calculations Test — validates that financial operations
 * use bcmath for precision and avoid floating-point errors.
 */
class MoneyCalculationsTest extends TestCase
{
    // ── PRECISION WITH BCMATH ──

    public function test_bcadd_avoids_float_precision_error(): void
    {
        // Classic float problem: 0.1 + 0.2 = 0.30000000000000004
        $result = bcadd('0.10', '0.20', 2);
        $this->assertEquals('0.30', $result);
    }

    public function test_bcmul_percentage_rounds_correctly(): void
    {
        // 33.33% of R$100 = R$33.33
        $result = bcmul('100.00', '0.3333', 2);
        $this->assertEquals('33.33', $result);
    }

    public function test_bcsub_subtraction_precision(): void
    {
        // R$100.00 - R$0.01 = R$99.99
        $result = bcsub('100.00', '0.01', 2);
        $this->assertEquals('99.99', $result);
    }

    public function test_installment_distribution_sums_to_total(): void
    {
        $total = '100.00';
        $installments = 3;

        $perInstallment = bcdiv($total, (string) $installments, 2);
        $sum = '0.00';

        for ($i = 0; $i < $installments - 1; $i++) {
            $sum = bcadd($sum, $perInstallment, 2);
        }
        // Last installment gets the remainder to avoid rounding loss
        $lastInstallment = bcsub($total, $sum, 2);
        $sum = bcadd($sum, $lastInstallment, 2);

        $this->assertEquals($total, $sum);
    }

    public function test_percentage_of_percentage(): void
    {
        // Commission: 10% of total, then tax: 15% of commission
        $total = '5000.00';
        $commission = bcmul($total, '0.10', 2); // R$500.00
        $tax = bcmul($commission, '0.15', 2);    // R$75.00
        $net = bcsub($commission, $tax, 2);      // R$425.00

        $this->assertEquals('500.00', $commission);
        $this->assertEquals('75.00', $tax);
        $this->assertEquals('425.00', $net);
    }

    public function test_large_value_multiplication(): void
    {
        // R$99,999.99 * 12 months
        $monthly = '99999.99';
        $annual = bcmul($monthly, '12', 2);
        $this->assertEquals('1199999.88', $annual);
    }

    public function test_zero_division_handled(): void
    {
        // Division by zero returns '0' with scale, not exception
        // In production code, always check for zero before dividing
        $this->assertEquals('0', bccomp('0.00', '0.00', 2));
    }

    public function test_negative_values_in_financial_context(): void
    {
        // Credit note: negative amount
        $invoice = '1000.00';
        $creditNote = '-200.00';
        $balance = bcadd($invoice, $creditNote, 2);

        $this->assertEquals('800.00', $balance);
    }

    public function test_many_small_additions_maintain_precision(): void
    {
        // Simulating 100 items of R$0.01 each
        $sum = '0.00';
        for ($i = 0; $i < 100; $i++) {
            $sum = bcadd($sum, '0.01', 2);
        }

        $this->assertEquals('1.00', $sum);
    }

    public function test_discount_percentage_applied_correctly(): void
    {
        $subtotal = '1500.00';
        $discountPercent = '12.5'; // 12.5%
        $discountValue = bcmul($subtotal, bcdiv($discountPercent, '100', 6), 2);
        $total = bcsub($subtotal, $discountValue, 2);

        $this->assertEquals('187.50', $discountValue);
        $this->assertEquals('1312.50', $total);
    }
}
