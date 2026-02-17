<?php

namespace App\Jobs;

use App\Models\Import;
use App\Services\ImportService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ImportJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 3600; // 1 hora de timeout para imports grandes

    public function __construct(
        protected Import $import
    ) {}

    public function handle(ImportService $importService): void
    {
        try {
            Log::info("Iniciando ImportJob para import #{$this->import->id}");
            $importService->processImport($this->import);
            Log::info("ImportJob finalizado com sucesso para import #{$this->import->id}");
        } catch (\Throwable $e) {
            Log::error("Falha no ImportJob #{$this->import->id}: " . $e->getMessage());
            
            $this->import->update([
                'status' => Import::STATUS_FAILED,
                'error_log' => array_merge($this->import->error_log ?? [], [[
                    'line' => 0,
                    'message' => 'Erro crítico no processamento: ' . $e->getMessage(),
                    'data' => []
                ]])
            ]);
            
            throw $e;
        }
    }
}
