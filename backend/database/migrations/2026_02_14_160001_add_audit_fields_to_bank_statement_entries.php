<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bank_statement_entries', function (Blueprint $table) {
            $table->string('category')->nullable();
            $table->enum('reconciled_by', ['manual', 'auto_match', 'rule', 'suggestion'])->nullable();
            $table->timestamp('reconciled_at')->nullable();
            $table->foreignId('reconciled_by_user_id')->nullable()
                ->constrained('users')->onUpdate('cascade')->onDelete('set null');
            $table->foreignId('rule_id')->nullable()
                ->constrained('reconciliation_rules')->onUpdate('cascade')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('bank_statement_entries', function (Blueprint $table) {
            $table->dropConstrainedForeignId('rule_id');
            $table->dropConstrainedForeignId('reconciled_by_user_id');
            $table->dropColumn(['category', 'reconciled_by', 'reconciled_at']);
        });
    }
};
