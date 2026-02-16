<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('cameras')) {
            return;
        }

        Schema::table('cameras', function (Blueprint $table) {
            if (!Schema::hasColumn('cameras', 'tenant_id')) {
                $table->foreignId('tenant_id')->nullable()->after('id')->constrained()->nullOnDelete();
                $table->index('tenant_id');
            }
            if (!Schema::hasColumn('cameras', 'location')) {
                $table->string('location')->nullable()->after('stream_url');
            }
            if (!Schema::hasColumn('cameras', 'type')) {
                $table->string('type')->default('ip')->after('location');
            }
        });
    }

    public function down(): void
    {
        Schema::table('cameras', function (Blueprint $table) {
            $table->dropForeign(['tenant_id']);
            $table->dropColumn(['tenant_id', 'location', 'type']);
        });
    }
};
