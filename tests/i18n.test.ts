import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('i18n files', () => {
  it('ru.json and en.json parse and contain objectEstimate and projectEstimate', () => {
    const ruRaw = fs.readFileSync(path.join(__dirname, '../src/i18n/locales/ru.json'), 'utf-8');
    const enRaw = fs.readFileSync(path.join(__dirname, '../src/i18n/locales/en.json'), 'utf-8');

    const ru = JSON.parse(ruRaw);
    const en = JSON.parse(enRaw);

    expect(ru.sidebar.projectEstimate).toBeDefined();
    expect(ru.sidebar.objectEstimate).toBeDefined();

    expect(en.sidebar.projectEstimate).toBeDefined();
    expect(en.sidebar.objectEstimate).toBeDefined();

    expect(ru.sidebar.projectEstimateWithName).toBeDefined();
    expect(en.sidebar.projectEstimateWithName).toBeDefined();
  });
});

import i18n from '../src/i18n/index';

describe('i18n sanity test', () => {
  it('i18n.isInitialized === true after import', () => {
    expect(i18n.isInitialized).toBe(true);
  });

  it('language is fixed to ru', () => {
    expect(i18n.language).toBe('ru');
  });

  it('t("sidebar.rooms") returns "Комнаты"', () => {
    expect(i18n.t('sidebar.rooms')).toBe('Комнаты');
  });

  it('i18n.t resolves nested keys and does not return raw keys', () => {
    const translation = i18n.t('sidebar.projectEstimate');
    expect(translation).not.toBe('sidebar.projectEstimate');
    expect(translation).not.toContain('.');
  });

  it('contract symmetry: ru.sidebar and en.sidebar have the same keys', () => {
    const ruRaw = fs.readFileSync(path.join(__dirname, '../src/i18n/locales/ru.json'), 'utf-8');
    const enRaw = fs.readFileSync(path.join(__dirname, '../src/i18n/locales/en.json'), 'utf-8');

    const ru = JSON.parse(ruRaw);
    const en = JSON.parse(enRaw);

    const ruKeys = Object.keys(ru.sidebar);
    const enKeys = Object.keys(en.sidebar);

    expect(ruKeys.sort()).toEqual(enKeys.sort());
  });
});
