// API: POST runs the common-slot algorithm across all members and returns matching slots
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { findCommonSlots, AvailabilityBlock } from '@/lib/scheduler';

// POST /api/scheduler/find-slots
// Body: { community_id, duration_hours }
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { community_id, duration_hours } = body;

        if (!community_id || !duration_hours) {
            return NextResponse.json(
                { error: 'community_id and duration_hours are required' },
                { status: 400 }
            );
        }

        // Fetch all availability for this community
        const { data: blocks, error: fetchError } = await supabase
            .from('availability')
            .select('user_id, day, hour')
            .eq('community_id', community_id);

        if (fetchError) throw fetchError;

        if (!blocks || blocks.length === 0) {
            return NextResponse.json({ slots: [], message: 'No availability data yet' });
        }

        const slots = findCommonSlots(blocks as AvailabilityBlock[], duration_hours);

        return NextResponse.json({ slots, total_users_with_availability: new Set(blocks.map((b: AvailabilityBlock) => b.user_id)).size });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to find slots' },
            { status: 500 }
        );
    }
}
