<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Expandir tabela equipments
        Schema::table('equipments', function (Blueprint $t) {
            $t->string('code', 30)->nullable();
            $t->string('category', 40)->default('outro');
            $t->string('manufacturer', 100)->nullable();
            $t->decimal('capacity', 14, 4)->nullable();
            $t->string('capacity_unit', 10)->nullable();
            $t->decimal('resolution', 14, 6)->nullable();
            $t->string('precision_class', 10)->nullable();
            $t->string('status', 30)->default('ativo');
            $t->string('location', 150)->nullable();
            $t->unsignedBigInteger('responsible_user_id')->nullable();
            $t->date('purchase_date')->nullable();
            $t->decimal('purchase_value', 12, 2)->nullable();
            $t->date('warranty_expires_at')->nullable();
            $t->date('last_calibration_at')->nullable();
            $t->date('next_calibration_at')->nullable();
            $t->unsignedSmallInteger('calibration_interval_months')->nullable();
            $t->string('inmetro_number', 50)->nullable();
            $t->string('certificate_number', 50)->nullable();
            $t->string('tag', 50)->nullable();
            $t->string('qr_code', 100)->nullable();
            $t->string('photo_url')->nullable();
            $t->boolean('is_critical')->default(false);
            $t->boolean('is_active')->default(true);
            $t->softDeletes();

            $t->foreign('responsible_user_id')->references('id')->on('users')->nullOnDelete();
            $t->index(['tenant_id', 'code']);
            $t->index(['tenant_id', 'status']);
            $t->index(['tenant_id', 'next_calibration_at']);
        });

        // Histórico de calibrações
        Schema::create('equipment_calibrations', function (Blueprint $t) {
            $t->id();
            $t->foreignId('equipment_id')->constrained('equipments')->cascadeOnDelete();
            $t->date('calibration_date');
            $t->date('next_due_date')->nullable();
            $t->string('calibration_type', 30)->default('externa');
            $t->string('result', 30)->default('aprovado');
            $t->string('laboratory', 150)->nullable();
            $t->string('certificate_number', 50)->nullable();
            $t->string('certificate_file')->nullable();
            $t->string('uncertainty', 50)->nullable();
            $t->json('errors_found')->nullable();
            $t->text('corrections_applied')->nullable();
            $t->unsignedBigInteger('performed_by')->nullable();
            $t->unsignedBigInteger('approved_by')->nullable();
            $t->decimal('cost', 12, 2)->nullable();
            $t->unsignedBigInteger('work_order_id')->nullable();
            $t->text('notes')->nullable();
            $t->timestamps();

            $t->foreign('performed_by')->references('id')->on('users')->nullOnDelete();
            $t->foreign('approved_by')->references('id')->on('users')->nullOnDelete();
            $t->foreign('work_order_id')->references('id')->on('work_orders')->nullOnDelete();
            $t->index(['equipment_id', 'calibration_date']);
        });

        // Histórico de manutenções
        Schema::create('equipment_maintenances', function (Blueprint $t) {
            $t->id();
            $t->foreignId('equipment_id')->constrained('equipments')->cascadeOnDelete();
            $t->string('type', 30)->default('corretiva');
            $t->text('description');
            $t->text('parts_replaced')->nullable();
            $t->decimal('cost', 12, 2)->nullable();
            $t->decimal('downtime_hours', 8, 2)->nullable();
            $t->unsignedBigInteger('performed_by')->nullable();
            $t->unsignedBigInteger('work_order_id')->nullable();
            $t->date('next_maintenance_at')->nullable();
            $t->timestamps();

            $t->foreign('performed_by')->references('id')->on('users')->nullOnDelete();
            $t->foreign('work_order_id')->references('id')->on('work_orders')->nullOnDelete();
        });

        // Documentos do equipamento
        Schema::create('equipment_documents', function (Blueprint $t) {
            $t->id();
            $t->foreignId('equipment_id')->constrained('equipments')->cascadeOnDelete();
            $t->string('type', 30)->default('certificado');
            $t->string('name', 150);
            $t->string('file_path');
            $t->date('expires_at')->nullable();
            $t->unsignedBigInteger('uploaded_by')->nullable();
            $t->timestamps();

            $t->foreign('uploaded_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('equipment_documents');
        Schema::dropIfExists('equipment_maintenances');
        Schema::dropIfExists('equipment_calibrations');

        Schema::table('equipments', function (Blueprint $t) {
            $t->dropForeign(['responsible_user_id']);
            $t->dropColumn([
                'code', 'category', 'manufacturer', 'capacity', 'capacity_unit',
                'resolution', 'precision_class', 'status', 'location',
                'responsible_user_id', 'purchase_date', 'purchase_value',
                'warranty_expires_at', 'last_calibration_at', 'next_calibration_at',
                'calibration_interval_months', 'inmetro_number', 'certificate_number',
                'tag', 'qr_code', 'photo_url', 'is_critical', 'is_active', 'deleted_at',
            ]);
        });
    }
};
