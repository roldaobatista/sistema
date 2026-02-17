<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // #30 — Assinatura digital na OS
        Schema::table('work_orders', function (Blueprint $table) {
            $table->string('signature_path')->nullable();
            $table->string('signature_signer')->nullable();
            $table->timestamp('signature_at')->nullable();
            $table->string('signature_ip', 45)->nullable();
        });

        // #24 — Recorrência de OS (contratos preventivos)
        Schema::create('recurring_contracts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('equipment_id')->nullable()->constrained('equipments')->nullOnDelete();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('created_by')->constrained('users');
            $table->string('name');
            $table->text('description')->nullable();
            $table->enum('frequency', ['weekly', 'biweekly', 'monthly', 'bimonthly', 'quarterly', 'semiannual', 'annual']);
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->date('next_run_date');
            $table->string('priority')->default('normal');
            $table->boolean('is_active')->default(true);
            $table->integer('generated_count')->default(0);
            $table->timestamps();
            $table->softDeletes();
        });

        // Items template para OS recorrentes
        Schema::create('recurring_contract_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('recurring_contract_id')->constrained()->cascadeOnDelete();
            $table->string('type'); // product, service
            $table->string('description');
            $table->decimal('quantity', 10, 2)->default(1);
            $table->decimal('unit_price', 10, 2);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::table('work_orders', function (Blueprint $table) {
            $table->dropColumn(['signature_path', 'signature_signer', 'signature_at', 'signature_ip']);
        });
        Schema::dropIfExists('recurring_contract_items');
        Schema::dropIfExists('recurring_contracts');
    }
};
