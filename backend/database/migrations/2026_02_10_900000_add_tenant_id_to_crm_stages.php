<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('crm_pipeline_stages', 'tenant_id')) {
            Schema::table('crm_pipeline_stages', function (Blueprint $table) {
                $table->foreignId('tenant_id')->nullable()->constrained()->cascadeOnDelete();
            });
        }

        // Populate tenant_id from parent pipeline using a compatible approach
        $pipelines = DB::table('crm_pipelines')->pluck('tenant_id', 'id');
        foreach ($pipelines as $pipelineId => $tenantId) {
            DB::table('crm_pipeline_stages')
                ->where('pipeline_id', $pipelineId)
                ->whereNull('tenant_id')
                ->update(['tenant_id' => $tenantId]);
        }

        // Make it required after population
        Schema::table('crm_pipeline_stages', function (Blueprint $table) {
            $table->foreignId('tenant_id')->nullable(false)->change();
        });
    }

    public function down(): void
    {
        Schema::table('crm_pipeline_stages', function (Blueprint $table) {
            $table->dropForeign(['tenant_id']);
            $table->dropColumn('tenant_id');
        });
    }
};
