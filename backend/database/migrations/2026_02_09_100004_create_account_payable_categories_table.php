<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('account_payable_categories', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->string('name', 100);
            $table->string('color', 20)->nullable()->default('#6b7280');
            $table->string('description', 255)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->index(['tenant_id', 'is_active']);
        });

        // Add category_id FK to accounts_payable
        if (Schema::hasTable('accounts_payable')) {
            Schema::table('accounts_payable', function (Blueprint $table) {
                if (!Schema::hasColumn('accounts_payable', 'category_id')) {
                    $table->unsignedBigInteger('category_id')->nullable()->after('category');
                    $table->foreign('category_id')->references('id')->on('account_payable_categories')->nullOnDelete();
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('accounts_payable') && Schema::hasColumn('accounts_payable', 'category_id')) {
            Schema::table('accounts_payable', function (Blueprint $table) {
                $table->dropForeign(['category_id']);
                $table->dropColumn('category_id');
            });
        }
        Schema::dropIfExists('account_payable_categories');
    }
};
