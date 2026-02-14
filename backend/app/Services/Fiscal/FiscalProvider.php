<?php

namespace App\Services\Fiscal;

/**
 * Strategy interface for fiscal document providers.
 *
 * Implementations handle API-specific logic (Nuvemfiscal, Focus NFe, etc.)
 * while the application code only depends on this contract.
 */
interface FiscalProvider
{
    /**
     * Issue an NF-e (Nota Fiscal Eletrônica — product/service invoice).
     */
    public function emitirNFe(array $data): FiscalResult;

    /**
     * Issue an NFS-e (Nota Fiscal de Serviço Eletrônica).
     */
    public function emitirNFSe(array $data): FiscalResult;

    /**
     * Check the status of an issued document by its access key.
     */
    public function consultarStatus(string $chaveAcesso): FiscalResult;

    /**
     * Cancel an issued document.
     */
    public function cancelar(string $chaveAcesso, string $justificativa): FiscalResult;

    /**
     * Download PDF (DANFE/DANFSE) for an issued document.
     *
     * @return string Base64-encoded PDF content or URL
     */
    public function downloadPdf(string $chaveAcesso): string;

    /**
     * Download XML (procured/authorized XML) for an issued document.
     *
     * @return string XML content or URL
     */
    public function downloadXml(string $chaveAcesso): string;
}
