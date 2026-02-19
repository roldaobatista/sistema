import { useState, useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/ui/pageheader'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { CommissionOverviewTab } from './commissions/CommissionOverviewTab'
import { CommissionEventsTab } from './commissions/CommissionEventsTab'
import { CommissionRulesTab } from './commissions/CommissionRulesTab'
import { CommissionSettlementsTab } from './commissions/CommissionSettlementsTab'
import { CommissionDisputesTab } from './commissions/CommissionDisputesTab'
import { CommissionGoalsTab } from './commissions/CommissionGoalsTab'
import { CommissionCampaignsTab } from './commissions/CommissionCampaignsTab'
import { CommissionRecurringTab } from './commissions/CommissionRecurringTab'
import { CommissionSimulatorTab } from './commissions/CommissionSimulatorTab'

const VALID_TABS = ['overview', 'events', 'rules', 'settlements', 'disputes', 'goals', 'campaigns', 'recurring', 'simulator'] as const
type TabValue = typeof VALID_TABS[number]

export function CommissionsPage() {
    const [searchParams, setSearchParams] = useSearchParams()

    const tabFromUrl = searchParams.get('tab') as TabValue | null
    const initialTab = tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'overview'
    const [activeTab, setActiveTab] = useState<TabValue>(initialTab)

    const initialEventFilters: Record<string, string> = {}
    const statusParam = searchParams.get('status')
    if (statusParam) initialEventFilters.status = statusParam

    const [eventFilters, setEventFilters] = useState<Record<string, string>>(initialEventFilters)

    const handleTabChange = useCallback((tab: string) => {
        const t = tab as TabValue
        setActiveTab(t)
        setSearchParams(prev => {
            const next = new URLSearchParams(prev)
            next.set('tab', t)
            // Clear filter params when switching tabs manually
            next.delete('status')
            return next
        }, { replace: true })
    }, [setSearchParams])

    const handleNavigateTab = useCallback((tab: string, filters?: Record<string, string>) => {
        const t = tab as TabValue
        setActiveTab(t)
        if (filters) setEventFilters(filters)
        setSearchParams(prev => {
            const next = new URLSearchParams(prev)
            next.set('tab', t)
            if (filters?.status) next.set('status', filters.status)
            else next.delete('status')
            return next
        }, { replace: true })
    }, [setSearchParams])

    // Sync tab from URL on back/forward navigation
    useEffect(() => {
        const t = searchParams.get('tab') as TabValue | null
        if (t && VALID_TABS.includes(t) && t !== activeTab) {
            setActiveTab(t)
        }
    }, [searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className='space-y-6'>
            <PageHeader
                title='Gestão de Comissões'
                subtitle='Configure regras, acompanhe eventos e realize fechamentos.'
            />

            <Tabs value={activeTab} onValueChange={handleTabChange} className='space-y-4'>
                <TabsList>
                    <TabsTrigger value='overview'>Visão Geral</TabsTrigger>
                    <TabsTrigger value='events'>Eventos</TabsTrigger>
                    <TabsTrigger value='rules'>Regras</TabsTrigger>
                    <TabsTrigger value='settlements'>Fechamentos</TabsTrigger>
                    <TabsTrigger value='disputes'>Contestações</TabsTrigger>
                    <TabsTrigger value='goals'>Metas</TabsTrigger>
                    <TabsTrigger value='campaigns'>Campanhas</TabsTrigger>
                    <TabsTrigger value='recurring'>Recorrentes</TabsTrigger>
                    <TabsTrigger value='simulator'>Simulador</TabsTrigger>
                </TabsList>

                <TabsContent value='overview'><CommissionOverviewTab onNavigateTab={handleNavigateTab} /></TabsContent>
                <TabsContent value='events'><CommissionEventsTab initialFilters={eventFilters} /></TabsContent>
                <TabsContent value='rules'><CommissionRulesTab /></TabsContent>
                <TabsContent value='settlements'><CommissionSettlementsTab /></TabsContent>
                <TabsContent value='disputes'><CommissionDisputesTab /></TabsContent>
                <TabsContent value='goals'><CommissionGoalsTab /></TabsContent>
                <TabsContent value='campaigns'><CommissionCampaignsTab /></TabsContent>
                <TabsContent value='recurring'><CommissionRecurringTab /></TabsContent>
                <TabsContent value='simulator'><CommissionSimulatorTab /></TabsContent>
            </Tabs>
        </div>
    )
}
