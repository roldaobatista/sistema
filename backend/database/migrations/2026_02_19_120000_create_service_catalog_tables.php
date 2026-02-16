<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('service_catalogs')) {
            Schema::create('service_catalogs', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->string('name');
                $table->string('slug', 64)->unique();
                $table->string('subtitle')->nullable();
                $table->text('header_description')->nullable();
                $table->boolean('is_published')->default(false);
                $table->timestamps();
                $table->index(['tenant_id', 'slug'], 'svc_cat_tenant_slug_idx');
                $table->foreign('tenant_id')->references('id')->on('tenants')->onUpdate('cascade')->onDelete('cascade');
            });
        }

        if (!Schema::hasTable('service_catalog_items')) {
            Schema::create('service_catalog_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('service_catalog_id')->constrained('service_catalogs')->onUpdate('cascade')->onDelete('cascade');
                $table->unsignedBigInteger('service_id')->nullable();
                $table->string('title');
                $table->text('description')->nullable();
                $table->string('image_path')->nullable();
                $table->unsignedInteger('sort_order')->default(0);
                $table->timestamps();
                $table->index(['service_catalog_id', 'sort_order'], 'svc_cat_item_order_idx');
                if (Schema::hasTable('services')) {
                    $table->foreign('service_id')->references('id')->on('services')->onUpdate('cascade')->onDelete('set null');
                }
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('service_catalog_items');
        Schema::dropIfExists('service_catalogs');
    }
};
