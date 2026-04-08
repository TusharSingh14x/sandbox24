// API: GET the current user's own availability blocks for a community
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// GET /api/scheduler/my-availability?community_id=xxx
// Returns only the current user's availability blocks for the given community
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const communityId = searchParams.get('community_id');

        if (!communityId) {
            return NextResponse.json({ error: 'community_id is required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('availability')
            .select('day, hour')
            .eq('community_id', communityId)
            .eq('user_id', user.id);

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch availability' },
            { status: 500 }
        );
    }
}
