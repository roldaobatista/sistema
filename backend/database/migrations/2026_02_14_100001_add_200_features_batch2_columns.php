<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 200 Features Batch 2: Add columns to existing tables for new functionalities.
 */
return new class extends Migration
{
    public function up(): void
    {
        // ─── WORK ORDERS: geolocation, profitability, pause, difficulty, etc. ──
        if (Schema::hasTable('work_orders')) {
            Schema::table('work_orders', function (Blueprint $table) {
                if (!Schema::hasColumn('work_orders', 'start_latitude')) {
                    $table->decimal('start_latitude', 10, 7)->nullable();
                    $table->decimal('start_longitude', 10, 7)->nullable();
                    $table->decimal('end_latitude', 10, 7)->nullable();
                    $table->decimal('end_longitude', 10, 7)->nullable();
                }
                if (!Schema::hasColumn('work_orders', 'total_cost')) {
                    $table->decimal('total_cost', 12, 2)->nullable();
                }
                if (!Schema::hasColumn('work_orders', 'profit_margin')) {
                    $table->decimal('profit_margin', 8, 2)->nullable();
                }
                if (!Schema::hasColumn('work_orders', 'difficulty_level')) {
                    $table->string('difficulty_level', 20)->nullable(); // easy, medium, hard
                }
                if (!Schema::hasColumn('work_orders', 'is_paused')) {
                    $table->boolean('is_paused')->default(false);
                    $table->timestamp('paused_at')->nullable();
                    $table->text('pause_reason')->nullable();
                }
                if (!Schema::hasColumn('work_orders', 'cancellation_reason')) {
                    $table->string('cancellation_category', 50)->nullable();
                    $table->text('cancellation_reason')->nullable();
                }
                if (!Schema::hasColumn('work_orders', 'reschedule_count')) {
                    $table->integer('reschedule_count')->default(0);
                }
                if (!Schema::hasColumn('work_orders', 'visit_number')) {
                    $table->integer('visit_number')->default(1);
                }
                if (!Schema::hasColumn('work_orders', 'parent_work_order_id')) {
                    $table->foreignId('parent_work_order_id')->nullable()
                        ->constrained('work_orders')->onUpdate('cascade')->onDelete('set null');
                }
                if (!Schema::hasColumn('work_orders', 'fleet_vehicle_id')) {
                    $table->foreignId('fleet_vehicle_id')->nullable()
                        ->constrained('fleet_vehicles')->onUpdate('cascade')->onDelete('set null');
                }
                if (!Schema::hasColumn('work_orders', 'cost_center_id')) {
                    $table->foreignId('cost_center_id')->nullable()
                        ->constrained('cost_centers')->onUpdate('cascade')->onDelete('set null');
                }
                if (!Schema::hasColumn('work_orders', 'rating_token')) {
                    $table->string('rating_token', 64)->nullable()->unique();
                }
            });
        }

        // ─── WORK ORDER ATTACHMENTS: categorias ──────────────────────
        if (Schema::hasTable('work_order_attachments')) {
            Schema::table('work_order_attachments', function (Blueprint $table) {
                if (!Schema::hasColumn('work_order_attachments', 'category')) {
                    $table->string('category', 30)->default('general'); // before, during, after, general
                }
            });
        }

        // ─── QUOTES: versioning, options, follow-up, view tracking ──
        if (Schema::hasTable('quotes')) {
            Schema::table('quotes', function (Blueprint $table) {
                if (!Schema::hasColumn('quotes', 'version_number')) {
                    $table->integer('version_number')->default(1);
                }
                if (!Schema::hasColumn('quotes', 'parent_quote_id')) {
                    $table->foreignId('parent_quote_id')->nullable()
                        ->constrained('quotes')->onUpdate('cascade')->onDelete('set null');
                }
                if (!Schema::hasColumn('quotes', 'viewed_at')) {
                    $table->timestamp('viewed_at')->nullable();
                    $table->integer('view_count')->default(0);
                }
                if (!Schema::hasColumn('quotes', 'loss_reason')) {
                    $table->string('loss_reason', 50)->nullable();
                    $table->text('loss_notes')->nullable();
                }
                if (!Schema::hasColumn('quotes', 'win_reason')) {
                    $table->string('win_reason', 50)->nullable();
                }
                if (!Schema::hasColumn('quotes', 'competitor_price')) {
                    $table->decimal('competitor_price', 12, 2)->nullable();
                    $table->string('competitor_name', 100)->nullable();
                }
                if (!Schema::hasColumn('quotes', 'price_table_id')) {
                    $table->foreignId('price_table_id')->nullable()
                        ->constrained('price_tables')->onUpdate('cascade')->onDelete('set null');
                }
            });
        }

        // ─── CUSTOMERS: segmentation, loyalty, scoring ──────────────
        if (Schema::hasTable('customers')) {
            Schema::table('customers', function (Blueprint $table) {
                if (!Schema::hasColumn('customers', 'segment')) {
                    $table->string('segment', 50)->nullable(); // government, industry, commerce, agro
                }
                if (!Schema::hasColumn('customers', 'abc_classification')) {
                    $table->string('abc_classification', 1)->nullable(); // A, B, C
                }
                if (!Schema::hasColumn('customers', 'credit_limit')) {
                    $table->decimal('credit_limit', 12, 2)->nullable();
                }
                if (!Schema::hasColumn('customers', 'nps_score')) {
                    $table->decimal('nps_score', 4, 1)->nullable();
                }
                if (!Schema::hasColumn('customers', 'ltv_total')) {
                    $table->decimal('ltv_total', 14, 2)->default(0);
                }
                if (!Schema::hasColumn('customers', 'churn_risk')) {
                    $table->string('churn_risk', 20)->nullable(); // low, medium, high
                }
                if (!Schema::hasColumn('customers', 'referred_by_customer_id')) {
                    $table->foreignId('referred_by_customer_id')->nullable()
                        ->constrained('customers')->onUpdate('cascade')->onDelete('set null');
                }
                if (!Schema::hasColumn('customers', 'loyalty_points')) {
                    $table->integer('loyalty_points')->default(0);
                }
                if (!Schema::hasColumn('customers', 'first_service_date')) {
                    $table->date('first_service_date')->nullable();
                }
            });
        }

        // ─── ACCOUNTS RECEIVABLE: collection tracking ────────────────
        if (Schema::hasTable('accounts_receivable')) {
            Schema::table('accounts_receivable', function (Blueprint $table) {
                if (!Schema::hasColumn('accounts_receivable', 'collection_rule_id')) {
                    $table->foreignId('collection_rule_id')->nullable()
                        ->constrained('collection_rules')->onUpdate('cascade')->onDelete('set null');
                }
                if (!Schema::hasColumn('accounts_receivable', 'last_collection_action_at')) {
                    $table->timestamp('last_collection_action_at')->nullable();
                }
                if (!Schema::hasColumn('accounts_receivable', 'days_overdue')) {
                    $table->integer('days_overdue')->default(0);
                }
            });
        }

        // ─── ACCOUNTS PAYABLE: cost center ───────────────────────────
        if (Schema::hasTable('accounts_payable')) {
            Schema::table('accounts_payable', function (Blueprint $table) {
                if (!Schema::hasColumn('accounts_payable', 'cost_center_id')) {
                    $table->foreignId('cost_center_id')->nullable()
                        ->constrained('cost_centers')->onUpdate('cascade')->onDelete('set null');
                }
            });
        }

        // ─── EXPENSES: cost center ───────────────────────────────────
        if (Schema::hasTable('expenses')) {
            Schema::table('expenses', function (Blueprint $table) {
                if (!Schema::hasColumn('expenses', 'cost_center_id')) {
                    $table->foreignId('cost_center_id')->nullable()
                        ->constrained('cost_centers')->onUpdate('cascade')->onDelete('set null');
                }
            });
        }

        // ─── EQUIPMENT CALIBRATIONS: nonconformity tracking ──────────
        if (Schema::hasTable('equipment_calibrations')) {
            Schema::table('equipment_calibrations', function (Blueprint $table) {
                if (!Schema::hasColumn('equipment_calibrations', 'has_nonconformity')) {
                    $table->boolean('has_nonconformity')->default(false);
                    $table->text('nonconformity_details')->nullable();
                }
                if (!Schema::hasColumn('equipment_calibrations', 'batch_generated')) {
                    $table->boolean('batch_generated')->default(false);
                }
                if (!Schema::hasColumn('equipment_calibrations', 'verification_token')) {
                    $table->string('verification_token', 64)->nullable()->unique();
                }
            });
        }

        // ─── EQUIPMENTS: QR code ─────────────────────────────────────
        if (Schema::hasTable('equipments')) {
            Schema::table('equipments', function (Blueprint $table) {
                if (!Schema::hasColumn('equipments', 'qr_code')) {
                    $table->string('qr_code', 128)->nullable()->unique();
                }
            });
        }

        // ─── SERVICE CALLS: reschedule tracking ──────────────────────
        if (Schema::hasTable('service_calls')) {
            Schema::table('service_calls', function (Blueprint $table) {
                if (!Schema::hasColumn('service_calls', 'reschedule_count')) {
                    $table->integer('reschedule_count')->default(0);
                    $table->text('reschedule_reason')->nullable();
                }
            });
        }

        // ─── USERS: HR fields ────────────────────────────────────────
        if (Schema::hasTable('users')) {
            Schema::table('users', function (Blueprint $table) {
                if (!Schema::hasColumn('users', 'hire_date')) {
                    $table->date('hire_date')->nullable();
                }
                if (!Schema::hasColumn('users', 'hour_bank_minutes')) {
                    $table->integer('hour_bank_minutes')->default(0);
                }
                if (!Schema::hasColumn('users', 'vacation_days_remaining')) {
                    $table->integer('vacation_days_remaining')->default(30);
                }
            });
        }
    }

    public function down(): void
    {
        // Reverse columns in existing tables
        Schema::table('users', function (Blueprint $table) {
            $cols = ['hire_date', 'hour_bank_minutes', 'vacation_days_remaining'];
            foreach ($cols as $c) { if (Schema::hasColumn('users', $c)) $table->dropColumn($c); }
        });

        Schema::table('service_calls', function (Blueprint $table) {
            $cols = ['reschedule_count', 'reschedule_reason'];
            foreach ($cols as $c) { if (Schema::hasColumn('service_calls', $c)) $table->dropColumn($c); }
        });

        Schema::table('equipments', function (Blueprint $table) {
            if (Schema::hasColumn('equipments', 'qr_code')) $table->dropColumn('qr_code');
        });

        Schema::table('equipment_calibrations', function (Blueprint $table) {
            $cols = ['has_nonconformity', 'nonconformity_details', 'batch_generated', 'verification_token'];
            foreach ($cols as $c) { if (Schema::hasColumn('equipment_calibrations', $c)) $table->dropColumn($c); }
        });

        Schema::table('expenses', function (Blueprint $table) {
            if (Schema::hasColumn('expenses', 'cost_center_id')) {
                $table->dropConstrainedForeignId('cost_center_id');
            }
        });

        Schema::table('accounts_payable', function (Blueprint $table) {
            if (Schema::hasColumn('accounts_payable', 'cost_center_id')) {
                $table->dropConstrainedForeignId('cost_center_id');
            }
        });

        Schema::table('accounts_receivable', function (Blueprint $table) {
            $cols = ['collection_rule_id', 'last_collection_action_at', 'days_overdue'];
            foreach ($cols as $c) { if (Schema::hasColumn('accounts_receivable', $c)) $table->dropColumn($c); }
        });

        Schema::table('customers', function (Blueprint $table) {
            $cols = ['segment', 'abc_classification', 'credit_limit', 'nps_score', 'ltv_total', 'churn_risk',
                     'referred_by_customer_id', 'loyalty_points', 'first_service_date'];
            foreach ($cols as $c) { if (Schema::hasColumn('customers', $c)) $table->dropColumn($c); }
        });

        Schema::table('quotes', function (Blueprint $table) {
            $cols = ['version_number', 'parent_quote_id', 'viewed_at', 'view_count',
                     'loss_reason', 'loss_notes', 'win_reason', 'competitor_price', 'competitor_name', 'price_table_id'];
            foreach ($cols as $c) { if (Schema::hasColumn('quotes', $c)) $table->dropColumn($c); }
        });

        Schema::table('work_order_attachments', function (Blueprint $table) {
            if (Schema::hasColumn('work_order_attachments', 'category')) $table->dropColumn('category');
        });

        Schema::table('work_orders', function (Blueprint $table) {
            $cols = ['start_latitude', 'start_longitude', 'end_latitude', 'end_longitude',
                     'total_cost', 'profit_margin', 'difficulty_level', 'is_paused', 'paused_at', 'pause_reason',
                     'cancellation_category', 'cancellation_reason', 'reschedule_count', 'visit_number',
                     'parent_work_order_id', 'fleet_vehicle_id', 'cost_center_id', 'rating_token'];
            foreach ($cols as $c) { if (Schema::hasColumn('work_orders', $c)) $table->dropColumn($c); }
        });
    }
};
