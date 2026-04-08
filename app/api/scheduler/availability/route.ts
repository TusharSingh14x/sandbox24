// API: GET all members' availability | POST save current user's availability blocks
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// GET /api/scheduler/availability?community_id=xxx
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const communityId = searchParams.get('community_id');

        if (!communityId) {
            return NextResponse.json({ error: 'community_id is required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('availability')
            .select('user_id, day, hour')
            .eq('community_id', communityId);

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch availability' },
            { status: 500 }
        );
    }
}

// POST /api/scheduler/availability
// Body: { community_id, blocks: [{ day, hour }] }
// Replaces the current user's availability for that community
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { community_id, blocks } = body;

        if (!community_id || !Array.isArray(blocks)) {
            return NextResponse.json({ error: 'community_id and blocks[] are required' }, { status: 400 });
        }

        // Delete old availability for this user + community
        const { error: deleteError } = await supabase
            .from('availability')
            .delete()
            .eq('community_id', community_id)
            .eq('user_id', user.id);

        if (deleteError) throw deleteError;

        // Insert new blocks (if any)
        if (blocks.length > 0) {
            const rows = blocks.map(({ day, hour }: { day: number; hour: number }) => ({
                community_id,
                user_id: user.id,
                day,
                hour,
            }));

            const { error: insertError } = await supabase.from('availability').insert(rows);
            if (insertError) throw insertError;
        }

        return NextResponse.json({ success: true, saved: blocks.length });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to save availability' },
            { status: 500 }
        );
    }
}
