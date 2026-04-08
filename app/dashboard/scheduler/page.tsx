// Page: Smart Event Scheduler — members mark availability, admin finds and confirms the best meeting slot
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AvailabilityGrid } from '@/components/AvailabilityGrid';
import { SlotResults } from '@/components/SlotResults';
import { CommonSlot, formatSlot, getDayName, buildGoogleCalendarUrl } from '@/lib/scheduler';
import { CalendarDays, Clock, Loader2, Sparkles, Users, CheckCircle2, CalendarPlus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useRole } from '@/hooks/use-role';
import { Chatbot } from '@/components/Chatbot';

interface Community { id: string; name: string; }

interface ConfirmedMeeting {
    id: string;
    day: number;
    start_hour: number;
    duration_hours: number;
    title: string;
    overlap_count: number;
}

const DURATIONS = [
    { label: '30 minutes', value: '0.5' },
    { label: '1 hour', value: '1' },
    { label: '1.5 hours', value: '1.5' },
    { label: '2 hours', value: '2' },
];

export default function SchedulerPage() {
    const searchParams = useSearchParams();
    const preselected = searchParams.get('community_id');
    const { toast } = useToast();
    const { role } = useRole();
    const isAdmin = role === 'admin';

    const [communities, setCommunities] = useState<Community[]>([]);
    const [selectedCommunity, setSelectedCommunity] = useState(preselected ?? '');
    const [duration, setDuration] = useState('1');
    const [slots, setSlots] = useState<CommonSlot[]>([]);
    const [totalUsers, setTotalUsers] = useState(0);
    const [finding, setFinding] = useState(false);
    const [hasResults, setHasResults] = useState(false);
    const [confirmedMeeting, setConfirmedMeeting] = useState<ConfirmedMeeting | null>(null);
    const [loadingConfirmed, setLoadingConfirmed] = useState(false);

    // Load joined communities
    useEffect(() => {
        fetch('/api/communities/memberships')
            .then(r => r.ok ? r.json() : { memberships: [] })
            .then(async ({ memberships }) => {
                if (!memberships?.length) return;
                const res = await fetch('/api/communities');
                if (!res.ok) return;
                const all: Community[] = await res.json();
                const joined = all.filter((c: Community) => memberships.includes(c.id));
                setCommunities(joined);
                if (!selectedCommunity && joined.length > 0) setSelectedCommunity(joined[0].id);
            })
            .catch(console.error);
    }, []);

    // Load confirmed meeting when community changes
    useEffect(() => {
        if (!selectedCommunity) return;
        setLoadingConfirmed(true);
        fetch(`/api/scheduler/confirm-slot?community_id=${selectedCommunity}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => setConfirmedMeeting(data))
            .catch(() => setConfirmedMeeting(null))
            .finally(() => setLoadingConfirmed(false));
    }, [selectedCommunity]);

    const handleFindSlots = async () => {
        if (!selectedCommunity) {
            toast({ title: 'Select a Club', description: 'Please choose a community first.', variant: 'destructive' });
            return;
        }
        setFinding(true);
        setHasResults(false);
        try {
            const res = await fetch('/api/scheduler/find-slots', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ community_id: selectedCommunity, duration_hours: parseFloat(duration) }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setSlots(data.slots ?? []);
            setTotalUsers(data.total_users_with_availability ?? 0);
            setHasResults(true);
        } catch (err) {
            toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to find slots', variant: 'destructive' });
        } finally {
            setFinding(false);
        }
    };

    const handleSlotConfirmed = () => {
        // Reload confirmed meeting
        if (!selectedCommunity) return;
        fetch(`/api/scheduler/confirm-slot?community_id=${selectedCommunity}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => setConfirmedMeeting(data))
            .catch(() => { });
    };

    const communityName = communities.find(c => c.id === selectedCommunity)?.name ?? 'Club';

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            {/* Header */}
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <CalendarDays size={26} className="text-blue-600" />
                    <h1 className="text-3xl font-bold text-slate-900">Smart Scheduler</h1>
                    <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">EdTech</Badge>
                </div>
                <p className="text-slate-500 text-sm">
                    {isAdmin
                        ? 'View member availability, find common slots, and confirm the final meeting time.'
                        : 'Mark your free time blocks — the admin will confirm the best meeting slot.'}
                </p>
            </div>

            {/* Config row */}
            <Card>
                <CardContent className="pt-4 pb-4">
                    <div className="flex flex-col sm:flex-row gap-3 items-end">
                        <div className="flex-1 space-y-1">
                            <label className="text-xs font-medium text-slate-600 flex items-center gap-1"><Users size={12} /> Club / Community</label>
                            <Select value={selectedCommunity} onValueChange={v => { setSelectedCommunity(v); setHasResults(false); }}>
                                <SelectTrigger><SelectValue placeholder="Select a community…" /></SelectTrigger>
                                <SelectContent>
                                    {communities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        {isAdmin && (
                            <div className="w-40 space-y-1">
                                <label className="text-xs font-medium text-slate-600 flex items-center gap-1"><Clock size={12} /> Duration</label>
                                <Select value={duration} onValueChange={v => { setDuration(v); setHasResults(false); }}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {DURATIONS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Confirmed Meeting Banner */}
            {selectedCommunity && !loadingConfirmed && confirmedMeeting && (
                <Card className="border-2 border-green-400 bg-green-50">
                    <CardContent className="pt-4 pb-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <CheckCircle2 size={28} className="text-green-600 shrink-0" />
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-bold text-green-900 text-base">{confirmedMeeting.title}</span>
                                        <Badge className="bg-green-600 text-white border-0 text-xs">✓ Confirmed by Admin</Badge>
                                    </div>
                                    <p className="text-green-700 font-medium mt-0.5">
                                        Every {getDayName(confirmedMeeting.day)}, {confirmedMeeting.start_hour}:00 — {confirmedMeeting.duration_hours}h
                                    </p>
                                    <p className="text-green-600 text-xs mt-0.5">
                                        {confirmedMeeting.overlap_count} member{confirmedMeeting.overlap_count !== 1 && 's'} available at this time
                                    </p>
                                </div>
                            </div>
                            <Button
                                size="sm"
                                variant="outline"
                                className="gap-2 border-green-500 text-green-700 hover:bg-green-100"
                                onClick={() => {
                                    const url = buildGoogleCalendarUrl(
                                        { day: confirmedMeeting.day, start_hour: confirmedMeeting.start_hour, duration_hours: confirmedMeeting.duration_hours, available_users: [], overlap_count: confirmedMeeting.overlap_count },
                                        confirmedMeeting.title,
                                        communityName
                                    );
                                    window.open(url, '_blank');
                                }}
                            >
                                <CalendarPlus size={14} />
                                Add to Calendar
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Main two-column layout */}
            <div className={`grid grid-cols-1 ${isAdmin ? 'lg:grid-cols-2' : ''} gap-6`}>
                {/* Step 1: Mark availability — everyone */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <span className="w-5 h-5 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">1</span>
                            Your Availability
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {selectedCommunity ? (
                            <AvailabilityGrid communityId={selectedCommunity} />
                        ) : (
                            <p className="text-slate-400 text-sm text-center py-10">Select a community above</p>
                        )}
                    </CardContent>
                </Card>

                {/* Step 2: Find & confirm — admin only */}
                {isAdmin && (
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <span className="w-5 h-5 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">2</span>
                                Find &amp; Confirm Meeting Slot
                                <Badge className="ml-auto bg-purple-100 text-purple-700 border-0 text-xs">Admin Only</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Button
                                onClick={handleFindSlots}
                                disabled={finding || !selectedCommunity}
                                className="w-full gap-2 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                            >
                                {finding
                                    ? <><Loader2 size={15} className="animate-spin" /> Analyzing…</>
                                    : <><Sparkles size={15} /> Find Best Common Slots</>}
                            </Button>

                            {hasResults ? (
                                <SlotResults
                                    slots={slots}
                                    totalUsers={totalUsers}
                                    communityName={communityName}
                                    communityId={selectedCommunity}
                                    durationHours={parseFloat(duration)}
                                    isAdmin={isAdmin}
                                    onSlotConfirmed={handleSlotConfirmed}
                                />
                            ) : !finding && (
                                <div className="text-center py-8 text-slate-400 text-sm">
                                    <Sparkles size={32} className="mx-auto mb-2 opacity-25" />
                                    Click the button above to find overlapping free slots from all members
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>

            <Chatbot />
        </div>
    );
}
