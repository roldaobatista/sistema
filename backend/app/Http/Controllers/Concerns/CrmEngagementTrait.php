<?php

namespace App\Http\Controllers\Concerns;

/**
 * Engagement domain: Web Forms, Interactive Proposals, Tracking, NPS, Referrals (T4 split).
 *
 * Methods: webForms, storeWebForm, updateWebForm, destroyWebForm, submitWebForm,
 *          interactiveProposals, createInteractiveProposal, viewInteractiveProposal, respondToProposal,
 *          trackingEvents, trackingPixel,
 *          npsAutomationConfig,
 *          referrals, storeReferral, updateReferral, referralStats,
 *          contractRenewals, generateRenewals, updateRenewal
 *
 * Extracted from CrmFeaturesController to improve maintainability.
 * Implementation bodies remain in CrmFeaturesController for backward compatibility.
 */
trait CrmEngagementTrait
{
    // Method bodies are in CrmFeaturesController – this trait exists as a
    // documentation & future-extraction marker for the Engagement domain.
}
