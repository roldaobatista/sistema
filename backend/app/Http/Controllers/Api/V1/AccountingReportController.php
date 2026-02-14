<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\JourneyEntry;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Carbon\Carbon;
use Illuminate\Support\Facades\Response;
use Illuminate\Support\Facades\Log;

class AccountingReportController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'start_date' => 'required|date',
                'end_date' => 'required|date|after_or_equal:start_date',
            ]);

            $query = JourneyEntry::with('user')
                ->whereBetween('date', [$request->start_date, $request->end_date]);

            if ($request->has('user_id')) {
                $query->where('user_id', $request->user_id);
            }

            return response()->json($query->paginate(50));
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            Log::error('AccountingReport index failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao gerar relatório contábil'], 500);
        }
    }

    public function export(Request $request)
    {
        try {
            $request->validate([
                'start_date' => 'required|date',
                'end_date' => 'required|date|after_or_equal:start_date',
                'format' => 'required|in:csv,json',
            ]);

            $entries = JourneyEntry::with('user')
                ->whereBetween('date', [$request->start_date, $request->end_date])
                ->get();

            if ($request->format === 'csv') {
                $headers = [
                    "Content-type" => "text/csv",
                    "Content-Disposition" => "attachment; filename=relatorio_contabil.csv",
                    "Pragma" => "no-cache",
                    "Cache-Control" => "must-revalidate, post-check=0, pre-check=0",
                    "Expires" => "0"
                ];

                $callback = function () use ($entries) {
                    $file = fopen('php://output', 'w');
                    fputs($file, "\xEF\xBB\xBF");

                    fputcsv($file, ['Colaborador', 'Data', 'Jornada Prevista', 'Trabalhado', 'HE 50%', 'HE 100%', 'Ad. Noturno', 'Faltas', 'Banco de Horas']);

                    foreach ($entries as $entry) {
                        fputcsv($file, [
                            $entry->user->name,
                            $entry->date,
                            $entry->scheduled_hours,
                            $entry->worked_hours,
                            $entry->overtime_hours_50,
                            $entry->overtime_hours_100,
                            $entry->night_hours,
                            $entry->absence_hours,
                            $entry->hour_bank_balance,
                        ]);
                    }
                    fclose($file);
                };

                return Response::stream($callback, 200, $headers);
            }

            return response()->json($entries);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['message' => 'Validação falhou', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            Log::error('AccountingReport export failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Erro ao exportar relatório'], 500);
        }
    }
}
