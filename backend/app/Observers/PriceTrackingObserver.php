<?php

namespace App\Observers;

use App\Models\PriceHistory;
use Illuminate\Database\Eloquent\Model;

class PriceTrackingObserver
{
    /**
     * Handle the "updating" event — fires before the model is saved.
     */
    public function updating(Model $model): void
    {
        $costChanged = $model->isDirty('cost_price');
        $sellChanged = $model->isDirty('sell_price');

        if (!$costChanged && !$sellChanged) {
            return;
        }

        $oldCost = $model->getOriginal('cost_price');
        $newCost = $model->cost_price;
        $oldSell = $model->getOriginal('sell_price');
        $newSell = $model->sell_price;

        // Calculate change percentage based on sell_price
        $changePercent = null;
        if ($sellChanged && $oldSell && $oldSell > 0) {
            $changePercent = round((($newSell - $oldSell) / $oldSell) * 100, 2);
        } elseif ($costChanged && $oldCost && $oldCost > 0) {
            $changePercent = round((($newCost - $oldCost) / $oldCost) * 100, 2);
        }

        PriceHistory::create([
            'tenant_id' => $model->tenant_id,
            'priceable_type' => get_class($model),
            'priceable_id' => $model->id,
            'old_cost_price' => $costChanged ? $oldCost : null,
            'new_cost_price' => $costChanged ? $newCost : null,
            'old_sell_price' => $sellChanged ? $oldSell : null,
            'new_sell_price' => $sellChanged ? $newSell : null,
            'change_percent' => $changePercent,
            'changed_by' => auth()->id(),
        ]);
    }
}
