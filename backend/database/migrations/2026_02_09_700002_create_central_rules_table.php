<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('central_rules', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->string('nome', 100);
            $table->string('descricao', 500)->nullable();
            $table->boolean('ativo')->default(true);

            // Condições
            $table->string('evento_trigger')->nullable(); // ex: WorkOrderStarted, QuoteApproved
            $table->string('tipo_item')->nullable();       // CentralItemType
            $table->string('status_trigger')->nullable();   // status que dispara a regra
            $table->string('prioridade_minima')->nullable(); // prioridade mínima para disparar

            // Ações
            $table->string('acao_tipo');                  // auto_assign, set_priority, set_due, notify, create_item
            $table->json('acao_config')->nullable();       // config JSON da ação

            // Filtros
            $table->unsignedBigInteger('responsavel_user_id')->nullable(); // auto-assign para esse user
            $table->string('role_alvo')->nullable();      // auto-assign por role

            // Metadata
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->index('tenant_id');
            $table->index('ativo');
            $table->index('evento_trigger');

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
            $table->foreign('responsavel_user_id')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('central_rules');
    }
};
