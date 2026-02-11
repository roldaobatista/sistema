<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('work_orders', function (Blueprint $table) {
            if (!Schema::hasColumn('work_orders', 'recurring_contract_id')) {
                $table->foreignId('recurring_contract_id')
                    ->nullable()
                    ->after('service_call_id')
                    ->constrained('recurring_contracts')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('work_orders', function (Blueprint $table) {
            if (Schema::hasColumn('work_orders', 'recurring_contract_id')) {
                $table->dropConstrainedForeignId('recurring_contract_id');
            }
        });
    }
};
