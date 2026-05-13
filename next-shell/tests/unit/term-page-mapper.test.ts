import { describe, expect, it } from 'vitest';
import {
  mapTermRecordToFormData,
  resolveSalesPersonNameFromLookup,
} from '@/components/features/term/mappers/term-page.mapper';
import { defaultTermFormData } from '@/types/term_form.types';

describe('term page sales person mapping', () => {
  it('treats SlpCode 0 as an empty Call By/Sourced By selection', () => {
    const formData = mapTermRecordToFormData(
      {
        SlpCode: 0,
        SlpName: '',
        SlpSprtCode: 0,
        SlpSprtName: '',
      },
      defaultTermFormData,
    );

    expect(formData.salesPerson).toBe('');
    expect(formData.salesPersonName).toBe('');
    expect(formData.sourcedBy).toBe('');
    expect(formData.sourcedByName).toBe('');
  });

  it('resolves blank view names from the OSLP lookup when a valid code exists', () => {
    const name = resolveSalesPersonNameFromLookup('37', '', [
      { code: '37', name: 'Center', active: 'Y' },
      { code: '173', name: 'BMC', active: 'Y' },
    ]);

    expect(name).toBe('Center');
  });

  it('keeps historical view names when the code is not in the active OSLP lookup', () => {
    const name = resolveSalesPersonNameFromLookup('15', 'Legacy Sales', [
      { code: '37', name: 'Center', active: 'Y' },
    ]);

    expect(name).toBe('Legacy Sales');
  });
});
