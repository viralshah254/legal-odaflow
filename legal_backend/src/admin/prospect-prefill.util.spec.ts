import {
  formatPersonName,
  mapProspectToPrefill,
  splitFullName,
} from './prospect-prefill.util';

describe('prospect-prefill.util', () => {
  it('formatPersonName title-cases each word', () => {
    expect(formatPersonName('  rohit   sharma  ')).toBe('Rohit Sharma');
  });

  it('splitFullName separates first and last names', () => {
    expect(splitFullName('Rohit Sharma')).toEqual({
      firstName: 'Rohit',
      lastName: 'Sharma',
    });
    expect(splitFullName('Madonna')).toEqual({
      firstName: 'Madonna',
      lastName: null,
    });
  });

  it('mapProspectToPrefill maps firm prospects', () => {
    expect(
      mapProspectToPrefill({
        id: 'p1',
        fullName: 'Rohit Sharma',
        firstName: 'Rohit',
        lastName: 'Sharma',
        organisation: 'Shende Advocates',
        practiceAreas: null,
        city: 'Ahmedabad',
        state: 'Gujarat',
        country: 'India',
        phone: '+919422314120',
        alternatePhone: null,
        whatsapp: '+919422314120',
        whatsappConfidence: 'high',
        email: 'rohit@example.com',
        emailConfidence: 'manual',
        website: null,
        profileUrl: null,
        barEnrollmentNumber: null,
        barCouncilState: null,
        lawyerVerified: false,
        verifiedAt: null,
        source: 'manual',
        dedupeKey: 'abc',
        outreachStatus: 'NEW',
        isTest: false,
        importRunId: null,
        scrapedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).toEqual({
      name: 'Rohit Sharma',
      firmName: 'Shende Advocates',
      practiceType: 'FIRM',
      phone: '+919422314120',
      countryCode: 'IN',
      jurisdiction: 'Gujarat',
    });
  });

  it('mapProspectToPrefill maps solo prospects', () => {
    expect(
      mapProspectToPrefill({
        id: 'p2',
        fullName: 'Priya Patel',
        firstName: 'Priya',
        lastName: 'Patel',
        organisation: null,
        practiceAreas: null,
        city: 'Ahmedabad',
        state: 'Gujarat',
        country: 'India',
        phone: '+919876543210',
        alternatePhone: null,
        whatsapp: '+919876543210',
        whatsappConfidence: 'high',
        email: 'priya@example.com',
        emailConfidence: 'manual',
        website: null,
        profileUrl: null,
        barEnrollmentNumber: null,
        barCouncilState: null,
        lawyerVerified: false,
        verifiedAt: null,
        source: 'manual',
        dedupeKey: 'def',
        outreachStatus: 'NEW',
        isTest: false,
        importRunId: null,
        scrapedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).toEqual({
      name: 'Priya Patel',
      practiceType: 'SOLO',
      phone: '+919876543210',
      countryCode: 'IN',
      jurisdiction: 'Gujarat',
    });
  });
});
