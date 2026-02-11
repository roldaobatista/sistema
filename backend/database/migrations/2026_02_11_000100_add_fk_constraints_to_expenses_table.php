<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            // Drop existing FKs without explicit onDelete/onUpdate
            $table->dropForeign(['created_by']);
            $table->dropForeign(['approved_by']);

            // Re-add with explicit cascade/restrict behavior
            $table->foreign('created_by')->references('id')->on('users')
                ->onUpdate('cascade')->onDelete('restrict');
            $table->foreign('approved_by')->references('id')->on('users')
                ->onUpdate('cascade')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            $table->dropForeign(['created_by']);
            $table->dropForeign(['approved_by']);

            // Restore original FKs without explicit behavior
            $table->foreign('created_by')->references('id')->on('users');
            $table->foreign('approved_by')->references('id')->on('users');
        });
    }
};
