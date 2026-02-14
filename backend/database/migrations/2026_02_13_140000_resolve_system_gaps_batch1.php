<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Batch 1 — Resolve structural gaps identified in system analysis.
 * GAP-01: Quote internal approval flow
 * GAP-02: WorkOrder dispatch authorization
 * GAP-03: Quote commercial source field
 * GAP-09: FuelingLog for drivers
 * GAP-10: Km rodado fields on expenses
 * GAP-14: CommissionGoal
 * GAP-19: CommissionEvent payment tracking
 * GAP-20: Expense review step
 */
return new class extends Migration
{
    public function up(): void
    {
        // GAP-01: Quote internal approval
        Schema::table('quotes', function (Blueprint $table) {
            $table->unsignedBigInteger('internal_approved_by')->nullable()->after('internal_notes');
            $table->timestamp('internal_approved_at')->nullable()->after('internal_approved_by');
            $table->foreign('internal_approved_by')->references('id')->on('users')->onDelete('set null');
        });

        // GAP-02: WorkOrder dispatch authorization
        Schema::table('work_orders', function (Blueprint $table) {
            $table->unsignedBigInteger('dispatch_authorized_by')->nullable()->after('sla_responded_at');
            $table->timestamp('dispatch_authorized_at')->nullable()->after('dispatch_authorized_by');
            $table->foreign('dispatch_authorized_by')->references('id')->on('users')->onDelete('set null');
        });

        // GAP-03: Quote commercial source
        Schema::table('quotes', function (Blueprint $table) {
            $table->string('source', 50)->nullable()->after('seller_id');
        });

        // GAP-09: Fueling log for drivers
        Schema::create('fueling_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
            $table->foreignId('work_order_id')->nullable()->constrained()->onUpdate('cascade')->onDelete('set null');
            $table->date('fueling_date');
            $table->string('vehicle_plate', 20);
            $table->decimal('odometer_km', 10, 1);
            $table->string('gas_station_name', 150)->nullable();
            $table->decimal('gas_station_lat', 10, 7)->nullable();
            $table->decimal('gas_station_lng', 10, 7)->nullable();
            $table->string('fuel_type', 30)->default('diesel');
            $table->decimal('liters', 8, 2);
            $table->decimal('price_per_liter', 8, 4);
            $table->decimal('total_amount', 10, 2);
            $table->string('receipt_path')->nullable();
            $table->text('notes')->nullable();
            $table->string('status', 20)->default('pending');
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->foreign('approved_by')->references('id')->on('users')->onDelete('set null');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['tenant_id', 'user_id', 'fueling_date']);
        });

        // GAP-10: Km rodado fields on expenses
        Schema::table('expenses', function (Blueprint $table) {
            $table->decimal('km_quantity', 10, 1)->nullable()->after('amount');
            $table->decimal('km_rate', 8, 4)->nullable()->after('km_quantity');
            $table->boolean('km_billed_to_client')->default(false)->after('km_rate');
        });

        // GAP-14: Commission goals (drop first — supersedes simpler version in advanced migration)
        Schema::dropIfExists('commission_goals');
        Schema::create('commission_goals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
            $table->string('period', 7); // 2026-02
            $table->string('type', 30)->default('revenue'); // revenue, os_count, new_clients
            $table->decimal('target_amount', 12, 2);
            $table->decimal('achieved_amount', 12, 2)->default(0);
            $table->decimal('bonus_percentage', 5, 2)->nullable();
            $table->decimal('bonus_amount', 10, 2)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'user_id', 'period', 'type']);
            $table->index(['tenant_id', 'period']);
        });

        // GAP-19: CommissionEvent payment tracking
        Schema::table('commission_events', function (Blueprint $table) {
            $table->unsignedBigInteger('account_receivable_id')->nullable()->after('work_order_id');
            $table->decimal('proportion', 5, 4)->default(1.0000)->after('commission_amount');
            $table->foreign('account_receivable_id')->references('id')->on('accounts_receivable')->onDelete('set null');
        });

        // GAP-20: Expense review step (Alessandra confere → Roldão aprova)
        Schema::table('expenses', function (Blueprint $table) {
            $table->unsignedBigInteger('reviewed_by')->nullable()->after('status');
            $table->timestamp('reviewed_at')->nullable()->after('reviewed_by');
            $table->foreign('reviewed_by')->references('id')->on('users')->onDelete('set null');
        });

        // GAP-25: Commission settlement workflow
        Schema::table('commission_settlements', function (Blueprint $table) {
            $table->unsignedBigInteger('closed_by')->nullable()->after('status');
            $table->timestamp('closed_at')->nullable()->after('closed_by');
            $table->unsignedBigInteger('approved_by')->nullable()->after('closed_at');
            $table->timestamp('approved_at')->nullable()->after('approved_by');
            $table->text('rejection_reason')->nullable()->after('approved_at');
            $table->foreign('closed_by')->references('id')->on('users')->onDelete('set null');
            $table->foreign('approved_by')->references('id')->on('users')->onDelete('set null');
        });

        // GAP-16 + GAP-21: New permissions
        $this->addPermissions();
    }

    public function down(): void
    {
        Schema::table('commission_settlements', function (Blueprint $table) {
            $table->dropForeign(['closed_by']);
            $table->dropForeign(['approved_by']);
            $table->dropColumn(['closed_by', 'closed_at', 'approved_by', 'approved_at', 'rejection_reason']);
        });

        Schema::table('expenses', function (Blueprint $table) {
            $table->dropForeign(['reviewed_by']);
            $table->dropColumn(['reviewed_by', 'reviewed_at']);
        });

        Schema::table('commission_events', function (Blueprint $table) {
            $table->dropForeign(['account_receivable_id']);
            $table->dropColumn(['account_receivable_id', 'proportion']);
        });

        Schema::dropIfExists('commission_goals');

        Schema::table('expenses', function (Blueprint $table) {
            $table->dropColumn(['km_quantity', 'km_rate', 'km_billed_to_client']);
        });

        Schema::dropIfExists('fueling_logs');

        Schema::table('quotes', function (Blueprint $table) {
            $table->dropColumn(['source']);
        });

        Schema::table('work_orders', function (Blueprint $table) {
            $table->dropForeign(['dispatch_authorized_by']);
            $table->dropColumn(['dispatch_authorized_by', 'dispatch_authorized_at']);
        });

        Schema::table('quotes', function (Blueprint $table) {
            $table->dropForeign(['internal_approved_by']);
            $table->dropColumn(['internal_approved_by', 'internal_approved_at']);
        });
    }

    private function addPermissions(): void
    {
        $permissions = [
            // GAP-02: Dispatch authorization
            'os.work_order.authorize_dispatch',
            // GAP-01: Internal approval
            'quotes.quote.internal_approve',
            // GAP-09: Fueling
            'expenses.fueling.view',
            'expenses.fueling.create',
            'expenses.fueling.approve',
            // GAP-20: Expense review
            'expenses.expense.review',
        ];

        $group = \App\Models\PermissionGroup::firstOrCreate(
            ['name' => 'Os'],
            ['order' => 50]
        );

        foreach ($permissions as $name) {
            $parts = explode('.', $name);
            $moduleName = ucfirst(str_replace('_', ' ', $parts[0]));
            $permGroup = \App\Models\PermissionGroup::firstOrCreate(
                ['name' => $moduleName],
                ['order' => 50]
            );

            $action = end($parts);
            $criticality = in_array($action, ['approve', 'authorize_dispatch', 'internal_approve', 'review']) ? 'HIGH' : 'MED';

            \Spatie\Permission\Models\Permission::firstOrCreate(
                ['name' => $name, 'guard_name' => 'web'],
                ['group_id' => $permGroup->id, 'criticality' => $criticality]
            );
        }
    }
};
