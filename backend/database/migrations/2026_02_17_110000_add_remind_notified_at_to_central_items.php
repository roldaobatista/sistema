<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('central_items')) {
            return;
        }
        if (Schema::hasColumn('central_items', 'remind_notified_at')) {
            return;
        }
        Schema::table('central_items', function (Blueprint $table) {
            $table->timestamp('remind_notified_at')->nullable();
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('central_items') || !Schema::hasColumn('central_items', 'remind_notified_at')) {
            return;
        }
        Schema::table('central_items', function (Blueprint $table) {
            $table->dropColumn('remind_notified_at');
        });
    }
};
