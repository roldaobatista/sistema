<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        $fks = [
            ['sessions', 'user_id', 'users', 'id'],
            ['inmetro_instruments', 'linked_equipment_id', 'equipments', 'id'],
            ['standard_weights', 'assigned_to_vehicle_id', 'fleet_vehicles', 'id'],
            ['standard_weights', 'assigned_to_user_id', 'users', 'id'],
            ['purchase_quotes', 'approved_supplier_id', 'suppliers', 'id'],
            ['purchase_quote_suppliers', 'supplier_id', 'suppliers', 'id'],
            ['material_requests', 'work_order_id', 'work_orders', 'id'],
            ['material_requests', 'warehouse_id', 'warehouses', 'id'],
            ['rma_requests', 'customer_id', 'customers', 'id'],
            ['rma_requests', 'supplier_id', 'suppliers', 'id'],
            ['rma_requests', 'work_order_id', 'work_orders', 'id'],
            ['stock_disposals', 'warehouse_id', 'warehouses', 'id'],
            ['stock_disposal_items', 'batch_id', 'stock_batches', 'id'],
            ['whatsapp_messages', 'customer_id', 'customers', 'id'],
            ['certificate_signatures', 'certificate_id', 'calibration_certificates', 'id'],
            ['retention_samples', 'work_order_id', 'work_orders', 'id'],
            ['lab_logbook_entries', 'user_id', 'users', 'id'],
            ['scale_readings', 'work_order_id', 'work_orders', 'id'],
            ['support_tickets', 'customer_id', 'customers', 'id'],
            ['chat_messages', 'ticket_id', 'support_tickets', 'id'],
            ['chat_messages', 'sender_id', 'users', 'id'],
            ['scheduled_appointments', 'customer_id', 'customers', 'id'],
            ['customer_locations', 'customer_id', 'customers', 'id'],
            ['nps_surveys', 'customer_id', 'customers', 'id'],
            ['nps_surveys', 'work_order_id', 'work_orders', 'id'],
            ['marketplace_requests', 'partner_id', 'partners', 'id'],
            ['sso_configurations', 'client_id', 'clients', 'id'],
            ['user_2fa', 'user_id', 'users', 'id'],
            ['user_sessions', 'user_id', 'users', 'id'],
            ['geo_login_alerts', 'user_id', 'users', 'id'],
            ['privacy_consents', 'user_id', 'users', 'id'],
            ['toll_transactions', 'vehicle_id', 'fleet_vehicles', 'id'],
            ['vehicle_gps_positions', 'vehicle_id', 'fleet_vehicles', 'id'],
            ['epi_records', 'user_id', 'users', 'id'],
            ['nfse_emissions', 'work_order_id', 'work_orders', 'id'],
            ['sync_queue', 'user_id', 'users', 'id'],
            ['mobile_notifications', 'user_id', 'users', 'id'],
            ['print_jobs', 'user_id', 'users', 'id'],
            ['print_jobs', 'document_id', 'documents', 'id'],
            ['voice_reports', 'user_id', 'users', 'id'],
            ['voice_reports', 'work_order_id', 'work_orders', 'id'],
            ['biometric_configs', 'user_id', 'users', 'id'],
            ['biometric_configs', 'device_id', 'devices', 'id'],
            ['photo_annotations', 'work_order_id', 'work_orders', 'id'],
            ['photo_annotations', 'user_id', 'users', 'id'],
            ['user_preferences', 'user_id', 'users', 'id'],
            ['funnel_email_automations', 'pipeline_stage_id', 'crm_pipeline_stages', 'id'],
            ['onboarding_processes', 'template_id', 'templates', 'id'],
            ['training_enrollments', 'course_id', 'training_courses', 'id'],
            ['contract_addendums', 'contract_id', 'recurring_contracts', 'id'],
            ['contract_adjustments', 'contract_id', 'recurring_contracts', 'id'],
            ['contract_measurements', 'contract_id', 'recurring_contracts', 'id'],
            ['non_conformances', 'equipment_id', 'equipments', 'id'],
            ['non_conformances', 'work_order_id', 'work_orders', 'id'],
            ['measurement_uncertainties', 'equipment_id', 'equipments', 'id'],
            ['measurement_uncertainties', 'calibration_id', 'equipment_calibrations', 'id'],
            ['recall_logs', 'equipment_id', 'equipments', 'id'],
            ['recall_logs', 'customer_id', 'customers', 'id'],
            ['quotes', 'parent_quote_id', 'quotes', 'id'],
            ['quotes', 'opportunity_id', 'crm_deals', 'id'],
            ['service_calls', 'template_id', 'templates', 'id'],
            ['equipment_calibrations', 'certificate_template_id', 'certificate_templates', 'id'],
        ];

        foreach ($fks as [$table, $column, $refTable, $refColumn]) {
            if (!Schema::hasTable($table) || !Schema::hasTable($refTable)) {
                continue;
            }
            if (!Schema::hasColumn($table, $column)) {
                continue;
            }
            $fkName = "{$table}_{$column}_foreign";
            $exists = DB::select("SELECT COUNT(*) as cnt FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?", [$table, $fkName]);
            if ($exists[0]->cnt > 0) {
                continue;
            }
            $isNullable = DB::selectOne("SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?", [$table, $column]);
            $onDelete = ($isNullable && $isNullable->IS_NULLABLE === 'YES') ? 'set null' : 'cascade';
            Schema::table($table, function (Blueprint $t) use ($column, $refTable, $refColumn, $onDelete) {
                $t->foreign($column)->references($refColumn)->on($refTable)->onDelete($onDelete);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        $fks = [
            ['sessions', 'user_id'],
            ['inmetro_instruments', 'linked_equipment_id'],
            ['standard_weights', 'assigned_to_vehicle_id'],
            ['standard_weights', 'assigned_to_user_id'],
            ['purchase_quotes', 'approved_supplier_id'],
            ['purchase_quote_suppliers', 'supplier_id'],
            ['material_requests', 'work_order_id'],
            ['material_requests', 'warehouse_id'],
            ['rma_requests', 'customer_id'],
            ['rma_requests', 'supplier_id'],
            ['rma_requests', 'work_order_id'],
            ['stock_disposals', 'warehouse_id'],
            ['stock_disposal_items', 'batch_id'],
            ['whatsapp_messages', 'customer_id'],
            ['certificate_signatures', 'certificate_id'],
            ['retention_samples', 'work_order_id'],
            ['lab_logbook_entries', 'user_id'],
            ['scale_readings', 'work_order_id'],
            ['support_tickets', 'customer_id'],
            ['chat_messages', 'ticket_id'],
            ['chat_messages', 'sender_id'],
            ['scheduled_appointments', 'customer_id'],
            ['customer_locations', 'customer_id'],
            ['nps_surveys', 'customer_id'],
            ['nps_surveys', 'work_order_id'],
            ['marketplace_requests', 'partner_id'],
            ['sso_configurations', 'client_id'],
            ['user_2fa', 'user_id'],
            ['user_sessions', 'user_id'],
            ['geo_login_alerts', 'user_id'],
            ['privacy_consents', 'user_id'],
            ['toll_transactions', 'vehicle_id'],
            ['vehicle_gps_positions', 'vehicle_id'],
            ['epi_records', 'user_id'],
            ['nfse_emissions', 'work_order_id'],
            ['sync_queue', 'user_id'],
            ['mobile_notifications', 'user_id'],
            ['print_jobs', 'user_id'],
            ['print_jobs', 'document_id'],
            ['voice_reports', 'user_id'],
            ['voice_reports', 'work_order_id'],
            ['biometric_configs', 'user_id'],
            ['biometric_configs', 'device_id'],
            ['photo_annotations', 'work_order_id'],
            ['photo_annotations', 'user_id'],
            ['user_preferences', 'user_id'],
            ['funnel_email_automations', 'pipeline_stage_id'],
            ['onboarding_processes', 'template_id'],
            ['training_enrollments', 'course_id'],
            ['contract_addendums', 'contract_id'],
            ['contract_adjustments', 'contract_id'],
            ['contract_measurements', 'contract_id'],
            ['non_conformances', 'equipment_id'],
            ['non_conformances', 'work_order_id'],
            ['measurement_uncertainties', 'equipment_id'],
            ['measurement_uncertainties', 'calibration_id'],
            ['recall_logs', 'equipment_id'],
            ['recall_logs', 'customer_id'],
            ['quotes', 'parent_quote_id'],
            ['quotes', 'opportunity_id'],
            ['service_calls', 'template_id'],
            ['equipment_calibrations', 'certificate_template_id'],
        ];

        foreach ($fks as [$table, $column]) {
            if (!Schema::hasTable($table)) {
                continue;
            }
            $fkName = "{$table}_{$column}_foreign";
            $exists = DB::select("SELECT COUNT(*) as cnt FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?", [$table, $fkName]);
            if ($exists[0]->cnt === 0) {
                continue;
            }
            Schema::table($table, function (Blueprint $t) use ($column) {
                $t->dropForeign([$column]);
            });
        }
    }
};
