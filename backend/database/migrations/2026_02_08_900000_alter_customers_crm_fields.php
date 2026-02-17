<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->string('source')->nullable();
            $table->string('segment')->nullable();
            $table->string('company_size')->nullable();
            $table->decimal('annual_revenue_estimate', 12, 2)->nullable();
            $table->string('contract_type')->nullable();
            $table->date('contract_start')->nullable();
            $table->date('contract_end')->nullable();
            $table->integer('health_score')->default(0);
            $table->timestamp('last_contact_at')->nullable();
            $table->timestamp('next_follow_up_at')->nullable();
            $table->foreignId('assigned_seller_id')->nullable()
                ->constrained('users')->nullOnDelete();
            $table->json('tags')->nullable();
            $table->string('rating')->nullable();
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
