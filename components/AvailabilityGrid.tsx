// Component: Interactive weekly availability grid — click/drag to mark free time blocks
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7 AM – 9 PM

function formatHour(h: number) {
    const period = h < 12 ? 'AM' : 'PM';
    const display = h % 12 === 0 ? 12 : h % 12;
    return `${display}:00 ${period}`;
}

interface AvailabilityGridProps {
    communityId: string;
}

export function AvailabilityGrid({ communityId }: AvailabilityGridProps) {
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [isDragging, setIsDragging] = useState(false);
    const [dragMode, setDragMode] = useState<'add' | 'remove'>('add');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch(`/api/scheduler/my-availability?community_id=${communityId}`);
                if (res.ok) {
                    const mine = await res.json();
                    setSelected(new Set(mine.map((b: { day: number; hour: number }) => `${b.day}-${b.hour}`)));
                }
            } catch {
                // ignore
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [communityId]);

    const toggleCell = useCallback((day: number, hour: number) => {
        const key = `${day}-${hour}`;
        setSelected(prev => {
            const next = new Set(prev);
            dragMode === 'add' ? next.add(key) : next.delete(key);
            return next;
        });
    }, [dragMode]);

    const handleMouseDown = (day: number, hour: number) => {
        const key = `${day}-${hour}`;
        const mode = selected.has(key) ? 'remove' : 'add';
        setDragMode(mode);
        setIsDragging(true);
        setSelected(prev => {
            const next = new Set(prev);
            mode === 'add' ? next.add(key) : next.delete(key);
            return next;
        });
    };

    const handleMouseEnter = (day: number, hour: number) => {
        if (!isDragging) return;
        toggleCell(day, hour);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const blocks = Array.from(selected).map(key => {
                const [day, hour] = key.split('-').map(Number);
                return { day, hour };
            });
            const res = await fetch('/api/scheduler/availability', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ community_id: communityId, blocks }),
            });
            if (res.ok) {
                toast({ title: '✅ Availability Saved!', description: `${blocks.length} block${blocks.length !== 1 ? 's' : ''} saved.` });
            } else {
                const err = await res.json();
                toast({ title: 'Error', description: err.error, variant: 'destructive' });
            }
        } catch {
            toast({ title: 'Error', description: 'Failed to save', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-blue-600" size={28} />
            </div>
        );
    }

    return (
        <div
            className="space-y-3"
            onMouseUp={() => setIsDragging(false)}
            onMouseLeave={() => setIsDragging(false)}
        >
            <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-slate-500">
                    Click &amp; drag to mark your <span className="text-blue-600 font-semibold">free</span> time blocks
                </p>
                <Button onClick={handleSave} disabled={saving} size="sm" className="gap-2 shrink-0">
                    {saving && <Loader2 size={14} className="animate-spin" />}
                    {saving ? 'Saving…' : 'Save'}
                </Button>
            </div>

            {/* Grid */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white">
                <table className="border-collapse" style={{ tableLayout: 'fixed', width: '100%', minWidth: 560 }}>
                    <colgroup>
                        {/* Time label column */}
                        <col style={{ width: 72 }} />
                        {/* 7 day columns equal width */}
                        {DAYS.map((_, i) => <col key={i} />)}
                    </colgroup>
                    <thead>
                        <tr>
                            <th className="bg-slate-50 border-b border-slate-200" />
                            {DAYS.map(day => (
                                <th
                                    key={day}
                                    className="py-2 text-xs font-semibold text-slate-600 border-b border-slate-200 bg-slate-50 text-center"
                                >
                                    {day}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {HOURS.map(hour => (
                            <tr key={hour}>
                                <td className="pr-2 pl-1 text-xs text-slate-400 text-right whitespace-nowrap border-r border-slate-100 bg-slate-50 select-none">
                                    {formatHour(hour)}
                                </td>
                                {DAYS.map((_, dayIdx) => {
                                    const key = `${dayIdx}-${hour}`;
                                    const isOn = selected.has(key);
                                    return (
                                        <td
                                            key={dayIdx}
                                            onMouseDown={(e) => { e.preventDefault(); handleMouseDown(dayIdx, hour); }}
                                            onMouseEnter={() => handleMouseEnter(dayIdx, hour)}
                                            className={[
                                                'border border-slate-100 cursor-pointer transition-colors duration-75 h-7',
                                                isOn ? 'bg-blue-500 hover:bg-blue-600' : 'bg-white hover:bg-blue-50',
                                            ].join(' ')}
                                        />
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" /> Available
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm bg-white border border-slate-200 inline-block" /> Busy
                </span>
                <span className="ml-auto">{selected.size} block{selected.size !== 1 ? 's' : ''} selected</span>
            </div>
        </div>
    );
}
