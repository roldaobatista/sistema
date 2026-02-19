<?php

namespace App\Http\Controllers\Concerns;

use App\Models\CrmDeal;
use App\Models\CrmForecastSnapshot;
use App\Models\CrmSmartAlert;
use App\Models\Customer;
use App\Models\Equipment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Forecast, Smart Alerts & Cross-sell domain (T4 split).
 *
 * Methods: forecast, snapshotForecast, historicalWinRate,
 *          smartAlerts, acknowledgeAlert, resolveAlert, dismissAlert, generateSmartAlerts,
 *          crossSellRecommendations
 *
 * Extracted from CrmFeaturesController to improve maintainability.
 * Implementation bodies remain in CrmFeaturesController for backward compatibility.
 */
trait CrmForecastAlertsTrait
{
    // Method bodies are in CrmFeaturesController – this trait exists as a
    // documentation & future-extraction marker for the Forecast + Alerts domain.
    //
    // When ready to fully extract, move the method implementations here and
    // add `use CrmForecastAlertsTrait;` in the controller.
}
