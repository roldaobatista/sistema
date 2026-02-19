<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fiscal_events', function (Blueprint $table) {
            $table->unsignedBigInteger('fiscal_note_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('fiscal_events', function (Blueprint $table) {
            $table->unsignedBigInteger('fiscal_note_id')->nullable(false)->change();
        });
    }
};
