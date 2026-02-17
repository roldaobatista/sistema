<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('service_checklists', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->string('name', 255);
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
        });

        Schema::create('service_checklist_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('checklist_id');
            $table->text('description');
            $table->string('type', 20)->default('check'); // check, text, number, photo, yes_no
            $table->boolean('is_required')->default(false);
            $table->integer('order_index')->default(0);
            $table->timestamps();

            $table->foreign('checklist_id')->references('id')->on('service_checklists')->cascadeOnDelete();
        });

        Schema::create('work_order_checklist_responses', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('work_order_id');
            $table->unsignedBigInteger('checklist_item_id');
            $table->text('value')->nullable(); // "true", "Sim", "12.5", path to photo
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('work_order_id')->references('id')->on('work_orders')->cascadeOnDelete();
            $table->foreign('checklist_item_id')->references('id')->on('service_checklist_items')->cascadeOnDelete();
        });

        Schema::table('work_orders', function (Blueprint $table) {
            $table->unsignedBigInteger('checklist_id')->nullable();
            $table->foreign('checklist_id')->references('id')->on('service_checklists')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('work_orders', function (Blueprint $table) {
            $table->dropForeign(['checklist_id']);
            $table->dropColumn('checklist_id');
        });
        Schema::dropIfExists('work_order_checklist_responses');
        Schema::dropIfExists('service_checklist_items');
        Schema::dropIfExists('service_checklists');
    }
};
