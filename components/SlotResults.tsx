// Component: Displays common meeting slots grouped by day — admin can confirm, all can export to Google Calendar
'use client';

import { useState } from 'react';
import { CommonSlot, formatHour, getDayName, buildGoogleCalendarUrl } from '@/lib/scheduler';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarPlus, Users, CheckCircle2, Loader2, CalendarDays } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface SlotResultsProps {
    slots: CommonSlot[];
    totalUsers: number;
    communityName: string;
    communityId: string;
    durationHours: number;
    isAdmin: boolean;
    onSlotConfirmed?: () => void;
}

export function SlotResults({
    slots, totalUsers, communityName, communityId, durationHours, isAdmin, onSlotConfirmed
}: SlotResultsProps) {
    const [confirming, setConfirming] = useState<string | null>(null);
    const { toast } = useToast();

    const handleConfirm = async (slot: CommonSlot) => {
        const key = `${slot.day}-${slot.start_hour}`;
        setConfirming(key);
        try {
            const res = await fetch('/api/scheduler/confirm-slot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    community_id: communityId,
                    day: slot.day,
                    start_hour: slot.start_hour,
                    duration_hours: slot.duration_hours,
                    title: `${communityName} Meeting`,
                    overlap_count: slot.overlap_count,
                }),
            });
            if (res.ok) {
                const dayStr = getDayName(slot.day);
                const timeStr = `${formatHour(slot.start_hour)} – ${formatHour(slot.start_hour + slot.duration_hours)}`;
                toast({ title: '✅ Meeting Confirmed!', description: `Every ${dayStr}, ${timeStr}` });
                onSlotConfirmed?.();
            } else {
                const err = await res.json();
                toast({ title: 'Error', description: err.error, variant: 'destructive' });
            }
        } catch {
            toast({ title: 'Error', description: 'Failed to confirm slot', variant: 'destructive' });
        } finally {
            setConfirming(null);
        }
    };

    if (slots.length === 0) {
        return (
            <Card className="border-dashed">
                <CardContent className="py-10 text-center">
                    <CalendarDays size={38} className="mx-auto text-slate-300 mb-3" />
                    <p className="text-slate-600 font-medium">No slots found</p>
                    <p className="text-slate-400 text-sm mt-1">
                        Ask members to save their availability, or try a shorter duration.
                    </p>
                </CardContent>
            </Card>
        );
    }

    // Group slots by day
    const byDay = new Map<number, CommonSlot[]>();
    for (const slot of slots) {
        if (!byDay.has(slot.day)) byDay.set(slot.day, []);
        byDay.get(slot.day)!.push(slot);
    }
    // Sort days 0→6
    const sortedDays = Array.from(byDay.keys()).sort((a, b) => a - b);

    // Find max overlap for colour coding
    const maxOverlap = Math.max(...slots.map(s => s.overlap_count), 1);

    return (
        <div className="space-y-4">
            <p className="text-sm text-slate-500">
                Found <span className="font-semibold text-slate-700">{slots.length}</span> slot{slots.length !== 1 && 's'} across{' '}
                <span className="font-semibold text-slate-700">{sortedDays.length}</span> day{sortedDays.length !== 1 && 's'} from{' '}
                <span className="font-semibold text-slate-700">{totalUsers}</span> member{totalUsers !== 1 && 's'}
                {isAdmin && <span className="ml-1 text-green-600 font-medium">— click Confirm to set the final time</span>}
            </p>

            {sortedDays.map(day => {
                const daySlots = byDay.get(day)!;
                return (
                    <Card key={day} className="overflow-hidden">
                        <CardHeader className="py-3 px-4 bg-slate-50 border-b">
                            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                <CalendarDays size={15} className="text-blue-600" />
                                {getDayName(day)}
                                <Badge variant="secondary" className="ml-auto text-xs">
                                    {daySlots.length} slot{daySlots.length !== 1 && 's'}
                                </Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-slate-100">
                                {daySlots.map(slot => {
                                    const key = `${slot.day}-${slot.start_hour}`;
                                    const isConfirming = confirming === key;
                                    const overlapPct = Math.round((slot.overlap_count / totalUsers) * 100);
                                    // Colour: green if max overlap, yellow if ≥50%, slate otherwise
                                    const barColor = slot.overlap_count === maxOverlap
                                        ? 'bg-green-500'
                                        : overlapPct >= 50 ? 'bg-yellow-400' : 'bg-blue-400';
                                    const gcUrl = buildGoogleCalendarUrl(slot, `${communityName} Meeting`, communityName);

                                    return (
                                        <div key={key} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                                            {/* Time */}
                                            <div className="w-36 shrink-0">
                                                <p className="text-sm font-semibold text-slate-800">
                                                    {formatHour(slot.start_hour)} – {formatHour(slot.start_hour + slot.duration_hours)}
                                                </p>
                                                {/* Overlap bar */}
                                                <div className="mt-1 h-1.5 rounded-full bg-slate-200 overflow-hidden w-24">
                                                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${overlapPct}%` }} />
                                                </div>
                                            </div>

                                            {/* Members count */}
                                            <div className="flex items-center gap-1 text-slate-500 text-xs shrink-0">
                                                <Users size={12} />
                                                <span>
                                                    <span className="font-semibold text-slate-700">{slot.overlap_count}</span>/{totalUsers} free
                                                    <span className="ml-1 text-slate-400">({overlapPct}%)</span>
                                                </span>
                                            </div>

                                            {/* Actions */}
                                            <div className="ml-auto flex gap-2 shrink-0">
                                                {isAdmin && (
                                                    <Button
                                                        size="sm"
                                                        className="gap-1 h-7 text-xs bg-green-600 hover:bg-green-700 px-2"
                                                        onClick={() => handleConfirm(slot)}
                                                        disabled={!!confirming}
                                                    >
                                                        {isConfirming
                                                            ? <Loader2 size={11} className="animate-spin" />
                                                            : <CheckCircle2 size={11} />}
                                                        {isConfirming ? 'Confirming…' : 'Confirm'}
                                                    </Button>
                                                )}
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="gap-1 h-7 text-xs px-2"
                                                    onClick={() => window.open(gcUrl, '_blank')}
                                                >
                                                    <CalendarPlus size={11} />
                                                    Calendar
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
