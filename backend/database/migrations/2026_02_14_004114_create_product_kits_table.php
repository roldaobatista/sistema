<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('product_kits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('parent_id')->constrained('products')->onDelete('cascade');
            $table->foreignId('child_id')->constrained('products')->onDelete('cascade');
            $table->decimal('quantity', 15, 4);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_kits');
    }
};
