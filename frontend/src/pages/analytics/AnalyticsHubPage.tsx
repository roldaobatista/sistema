import { useState } from 'react'
import {
    BarChart3,
    LayoutDashboard,
    BrainCircuit,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AnalyticsOverview } from './AnalyticsOverview'
import { PredictiveAnalytics } from './PredictiveAnalytics'
import { PdfExportButton } from '@/components/analytics/PdfExportButton'

function getDefaultDateRange() {
    const now = new Date()
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return {
        from: from.toISOString().split('T')[0],
        to: to.toISOString().split('T')[0],
    }
}

export function AnalyticsHubPage() {
    const defaults = getDefaultDateRange()
    const [from, setFrom] = useState(defaults.from)
    const [to, setTo] = useState(defaults.to)
    const [currentTab, setCurrentTab] = useState('overview')

    return (
        <div className="space-y-6" id="analytics-hub-container">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between no-print">
                <div>
                    <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
                        <BarChart3 className="h-7 w-7 text-brand-500" />
                        Analytics Hub
                    </h1>
                    <p className="text-sm text-surface-500 mt-1">Visão executiva consolidada e inteligência preditiva</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-300">
                    <PdfExportButton elementId="analytics-hub-container" fileName={`analytics-${currentTab}`} />

                    {currentTab === 'overview' && (
                        <div className="flex items-center gap-2 ml-2 pl-2 border-l border-default">
                            <input
                                type="date"
                                aria-label="Data inicial"
                                value={from}
                                onChange={e => setFrom(e.target.value)}
                                className="rounded-lg border border-default bg-surface-0 px-3 py-1.5 text-sm text-surface-700 focus:ring-2 focus:ring-brand-500"
                            />
                            <span className="text-surface-400 text-sm">até</span>
                            <input
                                type="date"
                                aria-label="Data final"
                                value={to}
                                onChange={e => setTo(e.target.value)}
                                className="rounded-lg border border-default bg-surface-0 px-3 py-1.5 text-sm text-surface-700 focus:ring-2 focus:ring-brand-500"
                            />
                        </div>
                    )}
                </div>
            </div>

            <Tabs defaultValue="overview" onValueChange={setCurrentTab} className="space-y-6">
                <TabsList>
                    <TabsTrigger value="overview" className="gap-2">
                        <LayoutDashboard className="h-4 w-4" />
                        Visão Geral
                    </TabsTrigger>
                    <TabsTrigger value="predictive" className="gap-2">
                        <BrainCircuit className="h-4 w-4" />
                        Inteligência Artificial
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview">
                    <AnalyticsOverview from={from} to={to} />
                </TabsContent>

                <TabsContent value="predictive">
                    <PredictiveAnalytics />
                </TabsContent>
            </Tabs>
        </div>
    )
}

export default AnalyticsHubPage
