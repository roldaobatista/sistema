<?php

namespace App\Console\Commands;

use App\Models\Product;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class CheckLowStock extends Command
{
    protected $signature = 'stock:check-low';
    protected $description = 'Verifica produtos com estoque abaixo do mínimo e gera notificações';

    public function handle(): int
    {
        $products = Product::where('is_active', true)
            ->where('stock_min', '>', 0)
            ->whereColumn('stock_qty', '<=', 'stock_min')
            ->with('category:id,name')
            ->get();

        if ($products->isEmpty()) {
            $this->info('Nenhum produto com estoque baixo encontrado.');
            return self::SUCCESS;
        }

        $count = 0;

        foreach ($products as $product) {
            $deficit = $product->stock_min - $product->stock_qty;

            try {
                $admins = User::where('tenant_id', $product->tenant_id)->limit(5)->get();

                foreach ($admins as $admin) {
                    Notification::notify(
                        tenantId: $product->tenant_id,
                        userId: $admin->id,
                        type: 'stock_alert',
                        title: "Estoque baixo: {$product->name}",
                        opts: [
                            'message' => "Produto \"{$product->name}\" (#{$product->code}) — atual: {$product->stock_qty} {$product->unit}, mínimo: {$product->stock_min} {$product->unit}.",
                            'icon' => 'package-minus',
                            'color' => 'amber',
                            'link' => "/cadastros/produtos/{$product->id}",
                            'notifiable_type' => Product::class,
                            'notifiable_id' => $product->id,
                            'data' => [
                                'product_id' => $product->id,
                                'stock_qty' => $product->stock_qty,
                                'stock_min' => $product->stock_min,
                                'deficit' => $deficit,
                            ],
                        ],
                    );
                }

                $count++;
            } catch (\Throwable $e) {
                Log::warning("CheckLowStock: falha para product #{$product->id}: {$e->getMessage()}");
            }
        }

        $this->info("Geradas notificações para {$count} produtos com estoque baixo.");

        return self::SUCCESS;
    }
}
