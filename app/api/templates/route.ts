import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const getFilePath = () => path.join(process.cwd(), 'lib', 'department_templates.json');

export async function GET() {
  try {
    const filePath = getFilePath();
    if (!fs.existsSync(filePath)) {
      // 파일이 없을 경우 빈 객체 기본 생성
      fs.writeFileSync(filePath, JSON.stringify({}), 'utf-8');
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return NextResponse.json(JSON.parse(data));
  } catch (err) {
    console.error('Failed to read templates JSON:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const filePath = getFilePath();
    fs.writeFileSync(filePath, JSON.stringify(body, null, 2), 'utf-8');
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to write templates JSON:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
