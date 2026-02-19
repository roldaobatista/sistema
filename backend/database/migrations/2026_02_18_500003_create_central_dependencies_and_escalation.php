<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Item dependencies (item X depends on item Y)
        Schema::create('central_item_dependencies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('item_id')->constrained('central_items')->cascadeOnDelete();
            $table->foreignId('depends_on_id')->constrained('central_items')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['item_id', 'depends_on_id']);
        });

        // Auto-escalation rules
        if (Schema::hasTable('central_items') && !Schema::hasColumn('central_items', 'escalation_hours')) {
            Schema::table('central_items', function (Blueprint $table) {
                $table->unsignedSmallInteger('escalation_hours')->nullable()
                    ->comment('Hours before auto-escalation of priority');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('central_item_dependencies');
        if (Schema::hasTable('central_items') && Schema::hasColumn('central_items', 'escalation_hours')) {
            Schema::table('central_items', function (Blueprint $table) {
                $table->dropColumn('escalation_hours');
            });
        }
    }
};
