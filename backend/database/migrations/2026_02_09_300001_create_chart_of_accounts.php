<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chart_of_accounts', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->string('code', 20);
            $table->string('name', 255);
            $table->string('type', 20); // revenue, expense, asset, liability
            $table->boolean('is_system')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreign('parent_id')->references('id')->on('chart_of_accounts')->nullOnDelete();
            $table->unique(['tenant_id', 'code']);
        });

        // Add chart_of_account_id to financial tables
        Schema::table('accounts_receivable', function (Blueprint $table) {
            $table->unsignedBigInteger('chart_of_account_id')->nullable();
            $table->foreign('chart_of_account_id')->references('id')->on('chart_of_accounts')->nullOnDelete();
        });

        Schema::table('accounts_payable', function (Blueprint $table) {
            $table->unsignedBigInteger('chart_of_account_id')->nullable();
            $table->foreign('chart_of_account_id')->references('id')->on('chart_of_accounts')->nullOnDelete();
        });

        Schema::table('expenses', function (Blueprint $table) {
            $table->unsignedBigInteger('chart_of_account_id')->nullable();
            $table->foreign('chart_of_account_id')->references('id')->on('chart_of_accounts')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            $table->dropForeign(['chart_of_account_id']);
            $table->dropColumn('chart_of_account_id');
        });
        Schema::table('accounts_payable', function (Blueprint $table) {
            $table->dropForeign(['chart_of_account_id']);
            $table->dropColumn('chart_of_account_id');
        });
        Schema::table('accounts_receivable', function (Blueprint $table) {
            $table->dropForeign(['chart_of_account_id']);
            $table->dropColumn('chart_of_account_id');
        });
        Schema::dropIfExists('chart_of_accounts');
    }
};
