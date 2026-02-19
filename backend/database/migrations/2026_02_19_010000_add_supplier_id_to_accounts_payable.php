<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('accounts_payable') && !Schema::hasColumn('accounts_payable', 'supplier_id')) {
            Schema::table('accounts_payable', function (Blueprint $table) {
                $table->unsignedBigInteger('supplier_id')->nullable()->after('created_by');
                $table->foreign('supplier_id')->references('id')->on('suppliers')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('accounts_payable') && Schema::hasColumn('accounts_payable', 'supplier_id')) {
            Schema::table('accounts_payable', function (Blueprint $table) {
                $table->dropForeign(['supplier_id']);
                $table->dropColumn('supplier_id');
            });
        }
    }
};
