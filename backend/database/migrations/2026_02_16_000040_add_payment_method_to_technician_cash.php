<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('technician_cash_funds', function (Blueprint $table) {
            $table->decimal('card_balance', 12, 2)->default(0)->after('balance');
        });

        Schema::table('technician_cash_transactions', function (Blueprint $table) {
            $table->string('payment_method', 20)->default('cash')->after('type');
        });
    }

    public function down(): void
    {
        Schema::table('technician_cash_funds', function (Blueprint $table) {
            $table->dropColumn('card_balance');
        });

        Schema::table('technician_cash_transactions', function (Blueprint $table) {
            $table->dropColumn('payment_method');
        });
    }
};
