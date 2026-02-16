<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('quotes', 'displacement_value')) {
            Schema::table('quotes', function (Blueprint $table) {
                $table->decimal('displacement_value', 10, 2)->default(0);
            });
        }
    }

    public function down(): void
    {
        Schema::table('quotes', function (Blueprint $table) {
            $table->dropColumn('displacement_value');
        });
    }
};
