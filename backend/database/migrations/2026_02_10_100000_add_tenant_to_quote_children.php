<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Add tenant_id to quote_equipments if not exists
        if (!Schema::hasColumn('quote_equipments', 'tenant_id')) {
            Schema::table('quote_equipments', function (Blueprint $table) {
                // We add nullable first to populate, then change to not null if needed, 
                // but for now we'll just add it. Given the existing data might exist,
                // we should cascade from quotes.
                $table->unsignedBigInteger('tenant_id')->after('id')->nullable();
                $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            });

            // Populate tenant_id from quotes
            DB::statement('
                UPDATE quote_equipments qe
                JOIN quotes q ON q.id = qe.quote_id
                SET qe.tenant_id = q.tenant_id
                WHERE qe.tenant_id IS NULL
            ');
            
             Schema::table('quote_equipments', function (Blueprint $table) {
                $table->unsignedBigInteger('tenant_id')->nullable(false)->change();
            });
        }

        // Add tenant_id to quote_items if not exists
        if (!Schema::hasColumn('quote_items', 'tenant_id')) {
            Schema::table('quote_items', function (Blueprint $table) {
                $table->unsignedBigInteger('tenant_id')->after('id')->nullable();
                $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            });

            // Populate tenant_id from quote_equipments
            DB::statement('
                UPDATE quote_items qi
                JOIN quote_equipments qe ON qe.id = qi.quote_equipment_id
                SET qi.tenant_id = qe.tenant_id
                WHERE qi.tenant_id IS NULL
            ');
            
             Schema::table('quote_items', function (Blueprint $table) {
                $table->unsignedBigInteger('tenant_id')->nullable(false)->change();
            });
        }

        // Add tenant_id to quote_photos if not exists
        if (!Schema::hasColumn('quote_photos', 'tenant_id')) {
            Schema::table('quote_photos', function (Blueprint $table) {
                $table->unsignedBigInteger('tenant_id')->after('id')->nullable();
                $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            });

             // Populate tenant_id from quote_equipments (photos relate to equipments or items)
             // Prioritize equipment relation first
            DB::statement('
                UPDATE quote_photos qp
                JOIN quote_equipments qe ON qe.id = qp.quote_equipment_id
                SET qp.tenant_id = qe.tenant_id
                WHERE qp.tenant_id IS NULL AND qp.quote_equipment_id IS NOT NULL
            ');

            // Then items
            DB::statement('
                UPDATE quote_photos qp
                JOIN quote_items qi ON qi.id = qp.quote_item_id
                SET qp.tenant_id = qi.tenant_id
                WHERE qp.tenant_id IS NULL AND qp.quote_item_id IS NOT NULL
            ');
            
             Schema::table('quote_photos', function (Blueprint $table) {
                $table->unsignedBigInteger('tenant_id')->nullable(false)->change();
            });
        }
    }

    public function down(): void
    {
        Schema::table('quote_photos', function (Blueprint $table) {
            $table->dropForeign(['tenant_id']);
            $table->dropColumn('tenant_id');
        });

        Schema::table('quote_items', function (Blueprint $table) {
            $table->dropForeign(['tenant_id']);
            $table->dropColumn('tenant_id');
        });

        Schema::table('quote_equipments', function (Blueprint $table) {
            $table->dropForeign(['tenant_id']);
            $table->dropColumn('tenant_id');
        });
    }
};
