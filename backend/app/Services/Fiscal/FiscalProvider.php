<?php

namespace App\Services\Fiscal;

/**
 * Strategy interface for fiscal document providers.
 *
 * Implementations handle API-specific logic (Focus NFe, Nuvemfiscal, etc.)
 * while the application code only depends on this contract.
 */
interface FiscalProvider
{
    /**
     * Issue an NF-e (Nota Fiscal Eletrônica — product invoice).
     */
    public function emitirNFe(array $data): FiscalResult;

    /**
     * Issue an NFS-e (Nota Fiscal de Serviço Eletrônica).
     */
    public function emitirNFSe(array $data): FiscalResult;

    /**
     * Check the status of an issued document by its reference.
     */
    public function consultarStatus(string $referencia): FiscalResult;

    /**
     * Cancel an issued document.
     */
    public function cancelar(string $referencia, string $justificativa): FiscalResult;

    /**
     * Render a range of NF-e numbers as unusable (inutilização).
     */
    public function inutilizar(array $data): FiscalResult;

    /**
     * Issue a Carta de Correção Eletrônica (CC-e) for an NF-e.
     */
    public function cartaCorrecao(string $referencia, string $correcao): FiscalResult;

    /**
     * Check SEFAZ service availability.
     */
    public function consultarStatusServico(string $uf): FiscalResult;

    /**
     * Download PDF (DANFE/DANFSE) for an issued document.
     *
     * @return string Binary PDF content
     */
    public function downloadPdf(string $referencia): string;

    /**
     * Download XML (authorized XML) for an issued document.
     *
     * @return string XML content
     */
    public function downloadXml(string $referencia): string;
}
