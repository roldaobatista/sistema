<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('equipment_models')) {
            Schema::create('equipment_models', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->string('name', 150);
                $table->string('brand', 100)->nullable();
                $table->string('category', 40)->nullable();
                $table->timestamps();

                $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
                $table->index('tenant_id');
            });
        }

        if (!Schema::hasTable('equipment_model_product')) {
            Schema::create('equipment_model_product', function (Blueprint $table) {
                $table->unsignedBigInteger('equipment_model_id');
                $table->unsignedBigInteger('product_id');
                $table->primary(['equipment_model_id', 'product_id'], 'eq_model_prod_primary');

                $table->foreign('equipment_model_id')->references('id')->on('equipment_models')->cascadeOnDelete();
                $table->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();
            });
        }

        if (Schema::hasTable('equipments') && !Schema::hasColumn('equipments', 'equipment_model_id')) {
            Schema::table('equipments', function (Blueprint $table) {
                $table->unsignedBigInteger('equipment_model_id')->nullable();
                $table->foreign('equipment_model_id')->references('id')->on('equipment_models')->onDelete('set null');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('equipments') && Schema::hasColumn('equipments', 'equipment_model_id')) {
            Schema::table('equipments', function (Blueprint $table) {
                $table->dropForeign(['equipment_model_id']);
                $table->dropColumn('equipment_model_id');
            });
        }
        Schema::dropIfExists('equipment_model_product');
        Schema::dropIfExists('equipment_models');
    }
};
