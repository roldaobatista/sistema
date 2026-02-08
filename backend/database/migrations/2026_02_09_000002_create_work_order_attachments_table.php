<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('work_order_attachments', function (Blueprint $t) {
            $t->id();
            $t->foreignId('work_order_id')->constrained()->cascadeOnDelete();
            $t->unsignedBigInteger('uploaded_by')->nullable();
            $t->string('file_name');
            $t->string('file_path');
            $t->string('file_type', 50)->nullable();
            $t->unsignedInteger('file_size')->nullable(); // bytes
            $t->string('description')->nullable();
            $t->timestamps();

            $t->foreign('uploaded_by')->references('id')->on('users')->nullOnDelete();
            $t->index('work_order_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('work_order_attachments');
    }
};
