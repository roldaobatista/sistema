<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->string('source')->nullable()->after('notes');
            $table->string('segment')->nullable()->after('source');
            $table->string('company_size')->nullable()->after('segment');
            $table->decimal('annual_revenue_estimate', 12, 2)->nullable()->after('company_size');
            $table->string('contract_type')->nullable()->after('annual_revenue_estimate');
            $table->date('contract_start')->nullable()->after('contract_type');
            $table->date('contract_end')->nullable()->after('contract_start');
            $table->integer('health_score')->default(0)->after('contract_end');
            $table->timestamp('last_contact_at')->nullable()->after('health_score');
            $table->timestamp('next_follow_up_at')->nullable()->after('last_contact_at');
            $table->foreignId('assigned_seller_id')->nullable()->after('next_follow_up_at')
                ->constrained('users')->nullOnDelete();
            $table->json('tags')->nullable()->after('assigned_seller_id');
            $table->string('rating')->nullable()->after('tags');
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropForeign(['assigned_seller_id']);
            $table->dropColumn([
                'source', 'segment', 'company_size', 'annual_revenue_estimate',
                'contract_type', 'contract_start', 'contract_end', 'health_score',
                'last_contact_at', 'next_follow_up_at', 'assigned_seller_id',
                'tags', 'rating',
            ]);
        });
    }
};
