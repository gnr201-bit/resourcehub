import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'department_templates')
      .maybeSingle();

    if (error || !data) {
      // system_settings 테이블에 템플릿 데이터가 없는 경우 기본값 반환
      const defaultTemplates = {
        'IT운영팀': {
          default_asset_keyword: 'MacBook',
          default_saas_names: ['Slack', 'Microsoft 365', 'Jira Software']
        },
        '인사팀': {
          default_asset_keyword: '그램',
          default_saas_names: ['Slack', 'Microsoft 365', 'Zoom']
        },
        '개발1팀': {
          default_asset_keyword: 'MacBook',
          default_saas_names: ['Slack', 'Microsoft 365', 'Jira Software']
        },
        '디자인팀': {
          default_asset_keyword: 'MacBook',
          default_saas_names: ['Slack', 'Figma']
        }
      };
      return NextResponse.json(defaultTemplates);
    }

    return NextResponse.json(data.value);
  } catch (err) {
    console.error('Failed to read templates from DB:', err);
    return NextResponse.json({ error: 'Failed to read templates' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = await createClient();

    // upsert 수행 (key: department_templates)
    const { error } = await supabase
      .from('system_settings')
      .upsert({
        key: 'department_templates',
        value: body,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });

    if (error) {
      console.error('DB templates save error:', error);
      return NextResponse.json({ error: 'Failed to save templates to DB' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to save templates:', err);
    return NextResponse.json({ error: 'Failed to save templates' }, { status: 500 });
  }
}

