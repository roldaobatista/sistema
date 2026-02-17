<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recurring_contracts', function (Blueprint $table) {
            $table->string('billing_type', 20)->default('per_os');
            $table->decimal('monthly_value', 10, 2)->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('recurring_contracts', function (Blueprint $table) {
            $table->dropColumn(['billing_type', 'monthly_value']);
        });
    }
};
