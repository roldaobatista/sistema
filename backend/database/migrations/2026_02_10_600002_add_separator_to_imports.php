<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasColumn('imports', 'separator')) {
            Schema::table('imports', function (Blueprint $t) {
                $t->string('separator', 10)->default(';');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('imports', 'separator')) {
            Schema::table('imports', function (Blueprint $t) {
                $t->dropColumn('separator');
            });
        }
    }
};
