<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('central_items')) {
            Schema::table('central_items', function (Blueprint $table) {
                if (!Schema::hasColumn('central_items', 'recurrence_pattern')) {
                    $table->string('recurrence_pattern', 30)->nullable();
                }
                if (!Schema::hasColumn('central_items', 'recurrence_interval')) {
                    $table->unsignedSmallInteger('recurrence_interval')->default(1);
                }
                if (!Schema::hasColumn('central_items', 'recurrence_next_at')) {
                    $table->timestamp('recurrence_next_at')->nullable();
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('central_items')) {
            Schema::table('central_items', function (Blueprint $table) {
                $cols = ['recurrence_pattern', 'recurrence_interval', 'recurrence_next_at'];
                $existing = array_filter($cols, fn ($c) => Schema::hasColumn('central_items', $c));
                if ($existing) {
                    $table->dropColumn($existing);
                }
            });
        }
    }
};
