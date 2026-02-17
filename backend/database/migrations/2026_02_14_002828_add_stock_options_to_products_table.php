<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (!Schema::hasColumn('products', 'is_kit')) {
                $table->boolean('is_kit')->default(false);
            }
            if (!Schema::hasColumn('products', 'track_batch')) {
                $table->boolean('track_batch')->default(false);
            }
            if (!Schema::hasColumn('products', 'track_serial')) {
                $table->boolean('track_serial')->default(false);
            }
            if (!Schema::hasColumn('products', 'min_repo_point')) {
                $table->decimal('min_repo_point', 15, 2)->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $cols = ['is_kit', 'track_batch', 'track_serial', 'min_repo_point'];
            foreach ($cols as $col) {
                if (Schema::hasColumn('products', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
