<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('work_order_signatures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
            $table->foreignId('work_order_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
            
            $table->string('signer_name');
            $table->string('signer_document')->nullable();
            $table->enum('signer_type', ['customer', 'technician']);
            
            $table->longText('signature_data'); // Base64 image
            $table->timestamp('signed_at');
            
            $table->string('ip_address')->nullable();
            $table->string('user_agent')->nullable();
            
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('work_order_signatures');
    }
};
