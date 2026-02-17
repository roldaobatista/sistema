<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('tenants', 'inmetro_config')) {
            Schema::table('tenants', function (Blueprint $table) {
                $table->json('inmetro_config')->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('tenants', 'inmetro_config')) {
            Schema::table('tenants', function (Blueprint $table) {
                $table->dropColumn('inmetro_config');
            });
        }
    }
};
