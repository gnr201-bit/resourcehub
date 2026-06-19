import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const settingsFilePath = path.join(process.cwd(), 'lib', 'settings.json');

export async function GET() {
  try {
    if (!fs.existsSync(settingsFilePath)) {
      const defaultSettings = {
        retiredAssetWarningDays: 3,
        assetStockThreshold: 3
      };
      fs.mkdirSync(path.dirname(settingsFilePath), { recursive: true });
      fs.writeFileSync(settingsFilePath, JSON.stringify(defaultSettings, null, 2), 'utf-8');
      return NextResponse.json(defaultSettings);
    }

    const fileContent = fs.readFileSync(settingsFilePath, 'utf-8');
    const settings = JSON.parse(fileContent);
    return NextResponse.json(settings);
  } catch (err) {
    console.error('Failed to read settings:', err);
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

    fs.mkdirSync(path.dirname(settingsFilePath), { recursive: true });
    fs.writeFileSync(settingsFilePath, JSON.stringify(updatedSettings, null, 2), 'utf-8');

    return NextResponse.json({ success: true, settings: updatedSettings });
  } catch (err) {
    console.error('Failed to save settings:', err);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
