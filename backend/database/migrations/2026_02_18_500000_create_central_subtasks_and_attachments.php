<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('central_subtasks', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->foreignId('central_item_id')->constrained('central_items')->cascadeOnDelete();
            $table->string('titulo', 255);
            $table->boolean('concluido')->default(false);
            $table->unsignedSmallInteger('ordem')->default(0);
            $table->foreignId('completed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['central_item_id', 'ordem']);
        });

        Schema::create('central_attachments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->foreignId('central_item_id')->constrained('central_items')->cascadeOnDelete();
            $table->string('nome', 255);
            $table->string('path', 500);
            $table->string('mime_type', 100)->nullable();
            $table->unsignedBigInteger('size')->default(0);
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('central_item_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('central_attachments');
        Schema::dropIfExists('central_subtasks');
    }
};
