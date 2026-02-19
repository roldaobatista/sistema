<?php

namespace App\Http\Controllers\Concerns;

/**
 * Territories, Sales Goals & Pipeline Velocity domain (T4 split).
 *
 * Methods: territories, storeTerritory, updateTerritory, destroyTerritory,
 *          salesGoals, storeSalesGoal, updateSalesGoal, recalculateGoals, goalsDashboard,
 *          pipelineVelocity,
 *          lossReasons, storeLossReason, updateLossReason, lossAnalytics
 *
 * Extracted from CrmFeaturesController to improve maintainability.
 * Implementation bodies remain in CrmFeaturesController for backward compatibility.
 */
trait CrmTerritoriesGoalsTrait
{
    // Method bodies are in CrmFeaturesController – this trait exists as a
    // documentation & future-extraction marker for the Territories + Goals domain.
}
