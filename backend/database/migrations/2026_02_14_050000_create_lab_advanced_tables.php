<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('sensor_readings')) {
            Schema::create('sensor_readings', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->string('sensor_id', 50);
                $table->string('sensor_type');
                $table->decimal('value', 12, 4);
                $table->string('unit', 10);
                $table->string('location', 100)->nullable();
                $table->timestamp('reading_at')->nullable();
                $table->timestamp('created_at')->nullable();
                $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
                $table->index(['tenant_id', 'sensor_id', 'reading_at']);
            });
        }

        if (!Schema::hasTable('certificate_signatures')) {
            Schema::create('certificate_signatures', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->unsignedBigInteger('certificate_id');
                $table->string('signer_name');
                $table->string('signer_role');
                $table->timestamp('signed_at')->nullable();
                $table->string('signature_hash')->nullable();
                $table->string('ip_address', 45)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            });
        }

        if (!Schema::hasTable('retention_samples')) {
            Schema::create('retention_samples', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->unsignedBigInteger('work_order_id')->nullable();
                $table->string('sample_code', 50);
                $table->string('description');
                $table->string('location', 100);
                $table->integer('retention_days');
                $table->date('expires_at')->nullable();
                $table->string('status')->default('stored');
                $table->timestamp('stored_at')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();
                $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            });
        }

        if (!Schema::hasTable('lab_logbook_entries')) {
            Schema::create('lab_logbook_entries', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->unsignedBigInteger('user_id');
                $table->date('entry_date');
                $table->string('type');
                $table->text('description');
                $table->decimal('temperature', 5, 2)->nullable();
                $table->decimal('humidity', 5, 2)->nullable();
                $table->timestamps();
                $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            });
        }

        if (!Schema::hasTable('raw_data_backups')) {
            Schema::create('raw_data_backups', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->string('scope');
                $table->date('date_from')->nullable();
                $table->date('date_to')->nullable();
                $table->string('status')->default('pending');
                $table->string('file_path')->nullable();
                $table->unsignedBigInteger('requested_by');
                $table->timestamps();
                $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            });
        }

        if (!Schema::hasTable('scale_readings')) {
            Schema::create('scale_readings', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->unsignedBigInteger('work_order_id')->nullable();
                $table->string('scale_identifier', 50);
                $table->decimal('reading_value', 12, 6);
                $table->string('unit', 10);
                $table->decimal('reference_weight', 12, 6)->nullable();
                $table->decimal('error', 12, 6)->nullable();
                $table->string('interface_type');
                $table->timestamp('reading_at')->nullable();
                $table->timestamp('created_at')->nullable();
                $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
                $table->index(['tenant_id', 'work_order_id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('scale_readings');
        Schema::dropIfExists('raw_data_backups');
        Schema::dropIfExists('lab_logbook_entries');
        Schema::dropIfExists('retention_samples');
        Schema::dropIfExists('certificate_signatures');
        Schema::dropIfExists('sensor_readings');
    }
};
