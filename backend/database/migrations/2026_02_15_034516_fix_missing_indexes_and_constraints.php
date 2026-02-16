<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $indexes = [
            'equipments' => [
                ['tenant_id', 'customer_id'],
                ['serial_number'],
            ],
            'service_calls' => [
                ['tenant_id', 'customer_id'],
                ['tenant_id', 'scheduled_date'],
                ['tenant_id', 'status'],
            ],
            'quotes' => [
                ['tenant_id', 'customer_id'],
                ['tenant_id', 'status'],
            ],
            'purchase_quotes' => [
                ['tenant_id'],
            ],
            'stock_disposals' => [
                ['tenant_id'],
            ],
            'asset_tags' => [
                ['tenant_id'],
            ],
            'material_requests' => [
                ['tenant_id'],
            ],
            'rma_requests' => [
                ['tenant_id'],
            ],
            'leave_requests' => [
                ['tenant_id', 'status'],
            ],
            'time_clock_entries' => [
                ['tenant_id', 'user_id', 'clock_in'],
            ],
            'time_clock_adjustments' => [
                ['tenant_id', 'status'],
            ],
            'fuel_logs' => [
                ['tenant_id', 'date'],
            ],
            'vehicle_accidents' => [
                ['tenant_id'],
            ],
            'vehicle_tires' => [
                ['tenant_id'],
            ],
            'vehicle_pool_requests' => [
                ['tenant_id'],
            ],
            'vehicle_insurances' => [
                ['tenant_id'],
            ],
            'toll_records' => [
                ['tenant_id'],
            ],
            'email_campaigns' => [
                ['tenant_id', 'status'],
            ],
            'whatsapp_messages' => [
                ['tenant_id'],
            ],
            'self_service_quote_requests' => [
                ['tenant_id', 'status'],
            ],
        ];

        foreach ($indexes as $table => $tableIndexes) {
            if (!Schema::hasTable($table)) {
                continue;
            }

            Schema::table($table, function (Blueprint $t) use ($tableIndexes, $table) {
                foreach ($tableIndexes as $columns) {
                    $indexName = $table . '_' . implode('_', $columns) . '_index';

                    if (strlen($indexName) > 64) {
                        $indexName = substr($indexName, 0, 64);
                    }

                    try {
                        $t->index($columns, $indexName);
                    } catch (\Throwable) {
                        // Index already exists
                    }
                }
            });
        }
    }

    public function down(): void
    {
        $indexes = [
            'equipments' => [
                'equipments_tenant_id_customer_id_index',
                'equipments_serial_number_index',
            ],
            'service_calls' => [
                'service_calls_tenant_id_customer_id_index',
                'service_calls_tenant_id_scheduled_date_index',
                'service_calls_tenant_id_status_index',
            ],
            'quotes' => [
                'quotes_tenant_id_customer_id_index',
                'quotes_tenant_id_status_index',
            ],
            'purchase_quotes' => ['purchase_quotes_tenant_id_index'],
            'stock_disposals' => ['stock_disposals_tenant_id_index'],
            'asset_tags' => ['asset_tags_tenant_id_index'],
            'material_requests' => ['material_requests_tenant_id_index'],
            'rma_requests' => ['rma_requests_tenant_id_index'],
            'leave_requests' => ['leave_requests_tenant_id_status_index'],
            'time_clock_entries' => ['time_clock_entries_tenant_id_user_id_clock_in_index'],
            'time_clock_adjustments' => ['time_clock_adjustments_tenant_id_status_index'],
            'fuel_logs' => ['fuel_logs_tenant_id_date_index'],
            'vehicle_accidents' => ['vehicle_accidents_tenant_id_index'],
            'vehicle_tires' => ['vehicle_tires_tenant_id_index'],
            'vehicle_pool_requests' => ['vehicle_pool_requests_tenant_id_index'],
            'vehicle_insurances' => ['vehicle_insurances_tenant_id_index'],
            'toll_records' => ['toll_records_tenant_id_index'],
            'email_campaigns' => ['email_campaigns_tenant_id_status_index'],
            'whatsapp_messages' => ['whatsapp_messages_tenant_id_index'],
            'self_service_quote_requests' => ['self_service_quote_requests_tenant_id_status_index'],
        ];

        foreach ($indexes as $table => $indexNames) {
            if (!Schema::hasTable($table)) {
                continue;
            }

            Schema::table($table, function (Blueprint $t) use ($indexNames) {
                foreach ($indexNames as $indexName) {
                    try {
                        $t->dropIndex($indexName);
                    } catch (\Throwable) {
                        // Index doesn't exist
                    }
                }
            });
        }
    }
};
