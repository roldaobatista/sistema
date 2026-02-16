<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bank_statements', function (Blueprint $table) {
            $table->unsignedBigInteger('bank_account_id')->nullable()->after('tenant_id');
            $table->foreign('bank_account_id')->references('id')->on('bank_accounts')->nullOnDelete();
        });

        Schema::table('bank_statement_entries', function (Blueprint $table) {
            $table->boolean('possible_duplicate')->default(false)->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('bank_statements', function (Blueprint $table) {
            $table->dropForeign(['bank_account_id']);
            $table->dropColumn('bank_account_id');
        });

        Schema::table('bank_statement_entries', function (Blueprint $table) {
            $table->dropColumn('possible_duplicate');
        });
    }
};
