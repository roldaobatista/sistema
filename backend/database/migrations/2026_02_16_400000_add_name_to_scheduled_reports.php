<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('scheduled_reports') && !Schema::hasColumn('scheduled_reports', 'name')) {
            Schema::table('scheduled_reports', function (Blueprint $table) {
                $table->string('name', 255)->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('scheduled_reports', 'name')) {
            Schema::table('scheduled_reports', function (Blueprint $table) {
                $table->dropColumn('name');
            });
        }
    }
};
