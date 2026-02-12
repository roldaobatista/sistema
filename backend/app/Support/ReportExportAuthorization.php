<?php

namespace App\Support;

class ReportExportAuthorization
{
    /**
     * @return array<string, string>
     */
    public static function aliases(): array
    {
        return [
            'os' => 'work-orders',
            'service_calls' => 'service-calls',
            'technician_cash' => 'technician-cash',
        ];
    }

    public static function normalizeType(string $type): string
    {
        $trimmed = trim($type);
        return self::aliases()[$trimmed] ?? $trimmed;
    }

    /**
     * @return array<string, string>
     */
    public static function permissionMap(): array
    {
        return [
            'work-orders' => 'reports.os_report.export',
            'productivity' => 'reports.productivity_report.export',
            'financial' => 'reports.financial_report.export',
            'commissions' => 'reports.commission_report.export',
            'profitability' => 'reports.margin_report.export',
            'quotes' => 'reports.quotes_report.export',
            'service-calls' => 'reports.service_calls_report.export',
            'technician-cash' => 'reports.technician_cash_report.export',
            'crm' => 'reports.crm_report.export',
            'equipments' => 'reports.equipments_report.export',
            'suppliers' => 'reports.suppliers_report.export',
            'stock' => 'reports.stock_report.export',
            'customers' => 'reports.customers_report.export',
        ];
    }

    public static function permissionForType(string $type): ?string
    {
        return self::permissionMap()[$type] ?? null;
    }
}
