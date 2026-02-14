<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('tool_checkouts')) {
            Schema::create('tool_checkouts', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->unsignedBigInteger('tool_id');
                $table->unsignedBigInteger('user_id');
                $table->timestamp('checked_out_at');
                $table->timestamp('checked_in_at')->nullable();
                $table->string('condition_out')->default('Bom');
                $table->string('condition_in')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();
                $table->softDeletes();

                $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
                $table->foreign('tool_id')->references('id')->on('products')->onDelete('cascade');
                $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');

                $table->index(['tenant_id', 'tool_id', 'checked_in_at']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('tool_checkouts');
    }
};
