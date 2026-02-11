<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('central_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');

            $table->string('tipo', 20);          // CentralItemType enum
            $table->string('origem', 20)->default('MANUAL'); // CentralItemOrigin enum

            // Referência polimórfica à entidade de origem (OS, Chamado, etc.)
            $table->string('ref_tipo', 100)->nullable();
            $table->unsignedBigInteger('ref_id')->nullable();

            // Dados do item
            $table->string('titulo', 255);
            $table->text('descricao_curta')->nullable();

            // Atribuição
            $table->unsignedBigInteger('responsavel_user_id');
            $table->unsignedBigInteger('criado_por_user_id');

            // Estado
            $table->string('status', 20)->default('ABERTO');       // CentralItemStatus
            $table->string('prioridade', 20)->default('MEDIA');     // CentralItemPriority
            $table->string('visibilidade', 20)->default('EQUIPE');  // CentralItemVisibility

            // Datas
            $table->timestamp('due_at')->nullable();
            $table->timestamp('remind_at')->nullable();
            $table->timestamp('snooze_until')->nullable();
            $table->timestamp('sla_due_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->unsignedBigInteger('closed_by')->nullable();

            // Dados extras
            $table->json('contexto')->nullable();  // {numero_os, cliente, telefone, link}
            $table->json('tags')->nullable();

            $table->timestamps();
            $table->softDeletes();

            // Índices para performance
            $table->index(['tenant_id', 'responsavel_user_id', 'status', 'due_at'], 'ci_user_status_due');
            $table->index(['tenant_id', 'tipo', 'status'], 'ci_tipo_status');
            $table->index(['tenant_id', 'sla_due_at'], 'ci_sla');
            $table->index(['tenant_id', 'created_at'], 'ci_created');
            $table->unique(['tenant_id', 'ref_tipo', 'ref_id'], 'ci_ref_unique');

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreign('responsavel_user_id')->references('id')->on('users');
            $table->foreign('criado_por_user_id')->references('id')->on('users');
            $table->foreign('closed_by')->references('id')->on('users')->nullOnDelete();
        });

        Schema::create('central_item_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('central_item_id')->constrained('central_items')->cascadeOnDelete();
            $table->unsignedBigInteger('user_id');
            $table->text('body');
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users');
            $table->index('central_item_id');
        });

        Schema::create('central_item_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('central_item_id')->constrained('central_items')->cascadeOnDelete();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('action', 50);       // status_changed, assigned, priority_changed, snoozed
            $table->string('from_value', 255)->nullable();
            $table->string('to_value', 255)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
            $table->index('central_item_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('central_item_history');
        Schema::dropIfExists('central_item_comments');
        Schema::dropIfExists('central_items');
    }
};
