<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('standard_weights', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->onUpdate('cascade')->onDelete('cascade');
            $table->string('code', 30)->comment('Código interno do peso padrão');
            $table->decimal('nominal_value', 12, 4)->comment('Valor nominal da massa (ex: 500.0000)');
            $table->string('unit', 10)->default('kg')->comment('Unidade: kg, g, mg');
            $table->string('serial_number', 100)->nullable();
            $table->string('manufacturer', 150)->nullable();
            $table->string('precision_class', 10)->nullable()->comment('Classe: E1, E2, F1, F2, M1, M2, M3');
            $table->string('material', 100)->nullable()->comment('Material: aço inox, ferro fundido, etc.');
            $table->string('shape', 50)->nullable()->comment('Formato: cilíndrico, retangular, disco');

            // Certificate info
            $table->string('certificate_number', 100)->nullable();
            $table->date('certificate_date')->nullable();
            $table->date('certificate_expiry')->nullable();
            $table->string('certificate_file', 500)->nullable()->comment('Path do arquivo PDF');
            $table->string('laboratory', 200)->nullable()->comment('Laboratório que emitiu o certificado');

            $table->enum('status', ['ativo', 'em_calibracao', 'fora_de_uso', 'descartado'])->default('ativo');
            $table->text('notes')->nullable();
            $table->softDeletes();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
            $table->index(['tenant_id', 'certificate_expiry']);
            $table->unique(['tenant_id', 'code']);
        });

        Schema::create('calibration_standard_weight', function (Blueprint $table) {
            $table->id();
            $table->foreignId('equipment_calibration_id')->constrained('equipment_calibrations')->onUpdate('cascade')->onDelete('cascade');
            $table->foreignId('standard_weight_id')->constrained('standard_weights')->onUpdate('cascade')->onDelete('restrict');
            $table->timestamps();

            $table->unique(['equipment_calibration_id', 'standard_weight_id'], 'cal_sw_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('calibration_standard_weight');
        Schema::dropIfExists('standard_weights');
    }
};
