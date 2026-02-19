<?php

namespace App\Http\Controllers\Concerns;

/**
 * Calendar & Analytics domain (T4 split).
 *
 * Methods: calendarEvents, storeCalendarEvent, updateCalendarEvent, destroyCalendarEvent,
 *          calendarActivities,
 *          cohortAnalysis, revenueIntelligence,
 *          competitiveMatrix, storeDealCompetitor, updateDealCompetitor,
 *          exportDealsCsv, importDealsCsv,
 *          featuresConstants
 *
 * Extracted from CrmFeaturesController to improve maintainability.
 * Implementation bodies remain in CrmFeaturesController for backward compatibility.
 */
trait CrmCalendarAnalyticsTrait
{
    // Method bodies are in CrmFeaturesController – this trait exists as a
    // documentation & future-extraction marker for the Calendar + Analytics domain.
}
