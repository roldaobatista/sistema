<?php

namespace App\Http\Controllers\Api\V1\Financial;

use App\Http\Controllers\Controller;
use App\Models\AccountReceivable;
use App\Models\AccountPayable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class FinancialExportController extends Controller
{
    /**
     * #27 — Exportação OFX (Open Financial Exchange).
     * GET /financial/export/ofx?type=receivable|payable&from=2024-01-01&to=2024-01-31
     */
    public function ofx(Request $request): Response
    {
        $validated = $request->validate([
            'type' => 'required|in:receivable,payable',
            'from' => 'required|date',
            'to' => 'required|date|after_or_equal:from',
        ]);

        $isReceivable = $validated['type'] === 'receivable';
        $model = $isReceivable ? AccountReceivable::class : AccountPayable::class;

        $records = $model::query()
            ->whereBetween('due_date', [$validated['from'], $validated['to']])
            ->with('customer:id,name')
            ->orderBy('due_date')
            ->get();

        $dtStart = str_replace('-', '', $validated['from']) . '000000';
        $dtEnd = str_replace('-', '', $validated['to']) . '235959';
        $acctId = $isReceivable ? '0001-RECEIVABLE' : '0002-PAYABLE';
        $acctType = $isReceivable ? 'SAVINGS' : 'CHECKING';

        $transactions = '';
        foreach ($records as $r) {
            $dt = $r->due_date->format('Ymd') . '120000';
            $amount = $isReceivable ? $r->amount : -$r->amount;
            $fitId = strtoupper(md5($r->id . $r->due_date));
            $name = $r->customer?->name ?? ($r->description ?? 'N/A');
            $memo = $r->description ?? '';

            $transactions .= "
<STMTTRN>
<TRNTYPE>" . ($amount >= 0 ? 'CREDIT' : 'DEBIT') . "
<DTPOSTED>{$dt}
<TRNAMT>{$amount}
<FITID>{$fitId}
<NAME>" . mb_substr($name, 0, 32) . "
<MEMO>{$memo}
</STMTTRN>";
        }

        $ofx = "OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:UTF-8
CHARSET:UTF-8
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS><CODE>0<SEVERITY>INFO</STATUS>
<DTSERVER>" . now()->format('YmdHis') . "
<LANGUAGE>POR
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>1
<STATUS><CODE>0<SEVERITY>INFO</STATUS>
<STMTRS>
<CURDEF>BRL
<BANKACCTFROM>
<BANKID>0000
<ACCTID>{$acctId}
<ACCTTYPE>{$acctType}
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>{$dtStart}
<DTEND>{$dtEnd}
{$transactions}
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>0.00
<DTASOF>" . now()->format('YmdHis') . "
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>";

        return response($ofx, 200, [
            'Content-Type' => 'application/x-ofx',
            'Content-Disposition' => "attachment; filename=\"export_{$validated['type']}_{$validated['from']}_{$validated['to']}.ofx\"",
        ]);
    }

    /**
     * Exportação CSV simples.
     * GET /financial/export/csv?type=receivable|payable&from=...&to=...
     */
    public function csv(Request $request): Response
    {
        $validated = $request->validate([
            'type' => 'required|in:receivable,payable',
            'from' => 'required|date',
            'to' => 'required|date|after_or_equal:from',
        ]);

        $isReceivable = $validated['type'] === 'receivable';
        $model = $isReceivable ? AccountReceivable::class : AccountPayable::class;

        $records = $model::query()
            ->whereBetween('due_date', [$validated['from'], $validated['to']])
            ->with('customer:id,name')
            ->orderBy('due_date')
            ->get();

        $csv = "Data Vencimento;Descrição;Cliente;Valor;Status;Valor Pago\n";

        foreach ($records as $r) {
            $date = $r->due_date->format('d/m/Y');
            $desc = str_replace(';', ',', $r->description ?? '');
            $customer = str_replace(';', ',', $r->customer?->name ?? '');
            $amount = number_format((float) $r->amount, 2, ',', '.');
            $paid = number_format((float) ($r->amount_paid ?? 0), 2, ',', '.');
            $status = $r->status ?? '';
            $csv .= "{$date};{$desc};{$customer};{$amount};{$status};{$paid}\n";
        }

        return response($csv, 200, [
            'Content-Type' => 'text/csv; charset=utf-8',
            'Content-Disposition' => "attachment; filename=\"export_{$validated['type']}_{$validated['from']}_{$validated['to']}.csv\"",
        ]);
    }
}
