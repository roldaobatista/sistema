<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Add 'critical' priority to inmetro_owners (SQLite-safe: uses string column instead of ENUM)
        Schema::table('inmetro_owners', function (Blueprint $table) {
            $table->string('priority', 20)->default('normal')->change();
        });

        // Add competitor link to inmetro_history (who repaired it?)
        Schema::table('inmetro_history', function (Blueprint $table) {
            $table->foreignId('competitor_id')->nullable()->after('executor')
                ->constrained('inmetro_competitors')->onUpdate('cascade')->onDelete('set null');
        });

        // Add estimated_revenue and total_instruments to owners for ranking
        Schema::table('inmetro_owners', function (Blueprint $table) {
            $table->decimal('estimated_revenue', 10, 2)->default(0)->after('notes');
            $table->unsignedInteger('total_instruments')->default(0)->after('estimated_revenue');
        });

        // Enhance competitors with capacity, classes, repair tracking
        Schema::table('inmetro_competitors', function (Blueprint $table) {
            $table->string('max_capacity', 50)->nullable()->after('mechanics');
            $table->json('accuracy_classes')->nullable()->after('max_capacity');
            $table->date('authorization_valid_until')->nullable()->after('accuracy_classes');
            $table->unsignedInteger('total_repairs_done')->default(0)->after('authorization_valid_until');
            $table->date('last_repair_date')->nullable()->after('total_repairs_done');
            $table->string('website', 255)->nullable()->after('last_repair_date');
        });

        // Pivot table: which competitor repaired which instrument
        Schema::create('competitor_instrument_repairs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('competitor_id')->constrained('inmetro_competitors')->onUpdate('cascade')->onDelete('cascade');
            $table->foreignId('instrument_id')->constrained('inmetro_instruments')->onUpdate('cascade')->onDelete('cascade');
            $table->date('repair_date');
            $table->string('seal_number', 50)->nullable();
            $table->text('notes')->nullable();
            $table->string('source', 30)->default('xml_import');
            $table->timestamps();

            $table->index(['competitor_id', 'repair_date']);
            $table->index(['instrument_id', 'repair_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('competitor_instrument_repairs');

        Schema::table('inmetro_competitors', function (Blueprint $table) {
            $table->dropColumn(['max_capacity', 'accuracy_classes', 'authorization_valid_until', 'total_repairs_done', 'last_repair_date', 'website']);
        });

        Schema::table('inmetro_owners', function (Blueprint $table) {
            $table->dropColumn(['estimated_revenue', 'total_instruments']);
        });

        Schema::table('inmetro_history', function (Blueprint $table) {
            $table->dropForeign(['competitor_id']);
            $table->dropColumn('competitor_id');
        });

        Schema::table('inmetro_owners', function (Blueprint $table) {
            $table->string('priority', 20)->default('normal')->change();
        });
    }
};
