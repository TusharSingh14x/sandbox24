// API: POST (admin-only) confirm a meeting slot | GET fetch the confirmed meeting for a community
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// POST /api/scheduler/confirm-slot
// Body: { community_id, day, start_hour, duration_hours, title }
// Admin-only: saves the confirmed meeting slot
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check admin role
        const { data: profile } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profile?.role !== 'admin') {
            return NextResponse.json({ error: 'Only admins can confirm meeting slots' }, { status: 403 });
        }

        const body = await request.json();
        const { community_id, day, start_hour, duration_hours, title, overlap_count } = body;

        if (!community_id || day === undefined || start_hour === undefined || !duration_hours) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Remove any existing confirmed meeting for this community first (one at a time)
        await supabase
            .from('scheduled_meetings')
            .delete()
            .eq('community_id', community_id);

        const { data, error } = await supabase
            .from('scheduled_meetings')
            .insert({
                community_id,
                created_by: user.id,
                title: title || 'Club Meeting',
                day,
                start_hour,
                duration_hours,
                overlap_count: overlap_count ?? 0,
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json(data, { status: 201 });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to confirm slot' },
            { status: 500 }
        );
    }
}

// GET /api/scheduler/confirm-slot?community_id=xxx
// Returns the confirmed meeting for a community (if any)
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const communityId = searchParams.get('community_id');

        if (!communityId) {
            return NextResponse.json({ error: 'community_id is required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('scheduled_meetings')
            .select('*')
            .eq('community_id', communityId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;

        return NextResponse.json(data ?? null);
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch meeting' },
            { status: 500 }
        );
    }
}
