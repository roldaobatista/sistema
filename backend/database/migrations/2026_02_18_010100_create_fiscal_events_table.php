<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fiscal_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('fiscal_note_id')->constrained('fiscal_notes')->onUpdate('cascade')->onDelete('cascade');
            $table->foreignId('tenant_id')->constrained('tenants')->onUpdate('cascade')->onDelete('restrict');

            $table->string('event_type', 30); // emission, cancellation, correction, inutilization
            $table->string('protocol_number', 50)->nullable();
            $table->text('description')->nullable();

            $table->longText('request_payload')->nullable();
            $table->longText('response_payload')->nullable();

            $table->string('status', 20)->default('pending');
            $table->text('error_message')->nullable();

            $table->foreignId('user_id')->nullable()->constrained('users')->onUpdate('cascade')->onDelete('set null');

            $table->timestamps();

            $table->index(['fiscal_note_id', 'event_type']);
            $table->index(['tenant_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fiscal_events');
    }
};
