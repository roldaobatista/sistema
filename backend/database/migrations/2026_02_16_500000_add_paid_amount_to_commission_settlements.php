<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('commission_settlements', function (Blueprint $table) {
            if (!Schema::hasColumn('commission_settlements', 'paid_amount')) {
                $table->decimal('paid_amount', 12, 2)->nullable();
            }
            if (!Schema::hasColumn('commission_settlements', 'payment_notes')) {
                $table->text('payment_notes')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('commission_settlements', function (Blueprint $table) {
            if (Schema::hasColumn('commission_settlements', 'paid_amount')) {
                $table->dropColumn('paid_amount');
            }
            if (Schema::hasColumn('commission_settlements', 'payment_notes')) {
                $table->dropColumn('payment_notes');
            }
        });
    }
};
