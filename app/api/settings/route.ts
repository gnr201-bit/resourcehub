import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'warning_rules')
      .maybeSingle();

    if (error || !data) {
      // system_settings 테이블이 아직 생성되지 않았거나 데이터가 없는 경우 기본값 반환
      const defaultSettings = {
        retiredAssetWarningDays: 3,
        assetStockThreshold: 3
      };
      return NextResponse.json(defaultSettings);
    }

    return NextResponse.json(data.value);
  } catch (err) {
    console.error('Failed to read settings from DB:', err);
    return NextResponse.json({ error: 'Failed to read settings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { retiredAssetWarningDays, assetStockThreshold } = body;

    if (typeof retiredAssetWarningDays !== 'number' || typeof assetStockThreshold !== 'number') {
      return NextResponse.json({ error: 'Invalid settings values' }, { status: 400 });
    }

    const updatedSettings = {
      retiredAssetWarningDays,
      assetStockThreshold
    };

    const supabase = await createClient();
    
    // upsert 수행
    const { error } = await supabase
      .from('system_settings')
      .upsert({
        key: 'warning_rules',
        value: updatedSettings,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });

    if (error) {
      console.error('DB settings save error:', error);
      return NextResponse.json({ error: 'Failed to save settings to DB' }, { status: 500 });
    }

    return NextResponse.json({ success: true, settings: updatedSettings });
  } catch (err) {
    console.error('Failed to save settings:', err);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
