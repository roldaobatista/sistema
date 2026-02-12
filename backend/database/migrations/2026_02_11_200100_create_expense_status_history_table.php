<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('expense_status_history', function (Blueprint $t) {
            $t->id();
            $t->foreignId('expense_id')->constrained()->cascadeOnUpdate()->cascadeOnDelete();
            $t->foreignId('changed_by')->constrained('users')->cascadeOnUpdate()->restrictOnDelete();
            $t->string('from_status', 20)->nullable();
            $t->string('to_status', 20);
            $t->string('reason', 500)->nullable();
            $t->timestamps();

            $t->index(['expense_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('expense_status_history');
    }
};
