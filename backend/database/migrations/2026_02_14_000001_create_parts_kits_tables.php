<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('parts_kits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
            $table->string('name');
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->index('tenant_id');
        });

        Schema::create('parts_kit_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('parts_kit_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
            $table->string('type')->default('product'); // product | service
            $table->foreignId('reference_id')->nullable(); // product_id or service_id
            $table->string('description');
            $table->decimal('quantity', 10, 2)->default(1);
            $table->decimal('unit_price', 12, 2)->default(0);
            $table->timestamps();

            $table->index('parts_kit_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('parts_kit_items');
        Schema::dropIfExists('parts_kits');
    }
};
