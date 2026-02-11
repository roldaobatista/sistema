<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('schedules', 'deleted_at')) {
            Schema::table('schedules', function (Blueprint $t) {
                $t->softDeletes();
            });
        }

        if (!Schema::hasColumn('time_entries', 'deleted_at')) {
            Schema::table('time_entries', function (Blueprint $t) {
                $t->softDeletes();
            });
        }
    }

    public function down(): void
    {
        Schema::table('schedules', function (Blueprint $t) {
            $t->dropSoftDeletes();
        });

        Schema::table('time_entries', function (Blueprint $t) {
            $t->dropSoftDeletes();
        });
    }
};
